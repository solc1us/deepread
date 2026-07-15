import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
	DifficultyLevel,
	PaperDifficultyClassification,
	PaperDifficultyV2Result,
} from "@deepread/api/services/difficulty-classifier";

import { loadServerEnv } from "./load-server-env";

const TARGET_CLASSIFICATION_VERSION = "rule-based-v2.1.4";
const BATCH_SIZE = 50;
const ELIGIBLE_STATUSES = ["published", "needs_review", "pending"] as const;
const PREVIEW_COLUMNS = [
	"paper_id",
	"title",
	"category_name",
	"current_status",
	"current_classification_version",
	"current_difficulty",
	"current_beginner_score",
	"proposed_outcome",
	"proposed_status",
	"proposed_difficulty",
	"proposed_beginner_score",
	"proposed_classification_version",
	"difficulty_change",
	"review_reasons",
	"has_bookmarks",
	"has_reading_progress",
	"has_notes",
] as const;
const BACKUP_COLUMNS = [
	"paper_id",
	"title",
	"current_status",
	"classification_id",
	"difficulty_level",
	"beginner_score",
	"estimated_reading_time",
	"abstract_length_score",
	"sentence_complexity_score",
	"jargon_density_score",
	"methodology_complexity_score",
	"statistical_complexity_score",
	"prerequisite_score",
	"clarity_score",
	"classification_reason",
	"reading_warning",
	"recommended_reader",
	"classification_version",
	"classification_created_at",
	"classification_updated_at",
] as const;
const DIFFICULTY_RANK: Record<DifficultyLevel, number> = {
	beginner_friendly: 0,
	moderate: 1,
	difficult: 2,
	expert: 3,
};
const previewPath = resolve(
	import.meta.dir,
	"../../../..",
	"tmp",
	"legacy-reclassification-preview.csv",
);

type PaperStatus = "pending" | "needs_review" | "published" | "rejected" | "inactive";
type CsvValue = string | number | boolean | null | undefined;
type CsvRow<Column extends string> = Record<Column, CsvValue>;

type StoredClassification = {
	id: string;
	difficultyLevel: DifficultyLevel;
	beginnerScore: number;
	estimatedReadingTime: number;
	abstractLengthScore: number;
	sentenceComplexityScore: number;
	jargonDensityScore: number;
	methodologyComplexityScore: number;
	statisticalComplexityScore: number;
	prerequisiteScore: number;
	clarityScore: number;
	classificationReason: string;
	readingWarning: string;
	recommendedReader: string;
	classificationVersion: string;
	createdAt: Date;
	updatedAt: Date;
};

type EligiblePaper = {
	id: string;
	title: string;
	abstract: string;
	keywords: unknown;
	publicationYear: number | null;
	status: PaperStatus;
	category: { name: string };
	classification: StoredClassification | null;
	_count: {
		bookmarks: number;
		readingProgress: number;
		readingNotes: number;
	};
};

type SuccessfulEvaluation = {
	status: "evaluated";
	paper: EligiblePaper;
	result: PaperDifficultyV2Result;
};

type FailedEvaluation = {
	status: "failed";
	paper: EligiblePaper;
	error: string;
};

type Evaluation = SuccessfulEvaluation | FailedEvaluation;

type Summary = {
	totalScanned: number;
	totalEligible: number;
	alreadyCurrent: number;
	skippedInactive: number;
	skippedRejected: number;
	wouldRemainPublished: number;
	wouldBecomePublished: number;
	wouldBecomeNeedsReview: number;
	difficultyUnchanged: number;
	difficultyChanged: number;
	successful: number;
	failed: number;
};

function escapeCsvField(value: CsvValue) {
	if (value === null || value === undefined) {
		return "";
	}

	const text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function serializeCsv<Column extends string>(
	columns: readonly Column[],
	rows: Array<CsvRow<Column>>,
) {
	const lines = [
		columns.join(","),
		...rows.map((row) => columns.map((column) => escapeCsvField(row[column])).join(",")),
	];

	return `${lines.join("\r\n")}\r\n`;
}

function toKeywords(value: unknown) {
	return Array.isArray(value)
		? value.filter(
				(item): item is string => typeof item === "string" && item.trim().length > 0,
			)
		: [];
}

function compareDifficulty(
	current: DifficultyLevel | null,
	proposed: DifficultyLevel | null,
): string {
	if (!proposed) return "needs_review";
	if (!current) return "new_classification";

	const difference = DIFFICULTY_RANK[proposed] - DIFFICULTY_RANK[current];
	if (difference === 0) return "same";
	if (difference === 1) return "one_level_harder";
	if (difference === -1) return "one_level_easier";
	if (difference > 1) return "two_or_more_levels_harder";
	return "two_or_more_levels_easier";
}

function getClassificationData(classification: PaperDifficultyClassification) {
	return {
		difficultyLevel: classification.difficultyLevel,
		beginnerScore: classification.beginnerScore,
		estimatedReadingTime: classification.estimatedReadingTime,
		abstractLengthScore: classification.scores.abstractLengthScore,
		sentenceComplexityScore: classification.scores.sentenceComplexityScore,
		jargonDensityScore: classification.scores.jargonDensityScore,
		methodologyComplexityScore: classification.scores.methodologyComplexityScore,
		statisticalComplexityScore: classification.scores.statisticalComplexityScore,
		prerequisiteScore: classification.scores.prerequisiteScore,
		clarityScore: classification.scores.clarityScore,
		classificationReason: classification.classificationReason,
		readingWarning: classification.readingWarning,
		recommendedReader: classification.recommendedReader,
		classificationVersion: TARGET_CLASSIFICATION_VERSION,
	};
}

function getSafeError(error: unknown, fallback: string) {
	if (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		typeof error.code === "string"
	) {
		return `${fallback} (${error.code})`;
	}

	return fallback;
}

function getTimestamp(date: Date) {
	return date
		.toISOString()
		.replace(/[-:]/g, "")
		.replace("T", "-")
		.slice(0, 15);
}

function getBackupPath() {
	return resolve(
		import.meta.dir,
		"../../../..",
		"tmp",
		`legacy-classification-backup-${getTimestamp(new Date())}.csv`,
	);
}

function chunk<T>(items: T[], size: number) {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += size) {
		chunks.push(items.slice(index, index + size));
	}
	return chunks;
}

function createSummary(counts: {
	totalScanned: number;
	totalEligible: number;
	alreadyCurrent: number;
	skippedInactive: number;
	skippedRejected: number;
}): Summary {
	return {
		...counts,
		wouldRemainPublished: 0,
		wouldBecomePublished: 0,
		wouldBecomeNeedsReview: 0,
		difficultyUnchanged: 0,
		difficultyChanged: 0,
		successful: 0,
		failed: 0,
	};
}

function updateProposalSummary(summary: Summary, evaluation: Evaluation) {
	if (evaluation.status === "failed") {
		summary.failed += 1;
		return;
	}

	const { paper, result } = evaluation;
	summary.successful += 1;

	if (result.outcome === "needs_review") {
		summary.wouldBecomeNeedsReview += 1;
		return;
	}

	if (paper.status === "published") {
		summary.wouldRemainPublished += 1;
	} else {
		summary.wouldBecomePublished += 1;
	}

	const difficultyChange = compareDifficulty(
		paper.classification?.difficultyLevel ?? null,
		result.classification.difficultyLevel,
	);
	if (difficultyChange === "same") {
		summary.difficultyUnchanged += 1;
	} else if (difficultyChange !== "new_classification") {
		summary.difficultyChanged += 1;
	}
}

function createPreviewRow(
	evaluation: Evaluation,
): CsvRow<(typeof PREVIEW_COLUMNS)[number]> {
	const { paper } = evaluation;
	const base = {
		paper_id: paper.id,
		title: paper.title,
		category_name: paper.category.name,
		current_status: paper.status,
		current_classification_version: paper.classification?.classificationVersion,
		current_difficulty: paper.classification?.difficultyLevel,
		current_beginner_score: paper.classification?.beginnerScore,
		has_bookmarks: paper._count.bookmarks > 0,
		has_reading_progress: paper._count.readingProgress > 0,
		has_notes: paper._count.readingNotes > 0,
	};

	if (evaluation.status === "failed") {
		return {
			...base,
			proposed_outcome: "failed",
			proposed_status: paper.status,
			proposed_difficulty: null,
			proposed_beginner_score: null,
			proposed_classification_version: null,
			difficulty_change: null,
			review_reasons: evaluation.error,
		};
	}

	if (evaluation.result.outcome === "needs_review") {
		return {
			...base,
			proposed_outcome: "needs_review",
			proposed_status: "needs_review",
			proposed_difficulty: null,
			proposed_beginner_score: null,
			proposed_classification_version: evaluation.result.classificationVersion,
			difficulty_change: "needs_review",
			review_reasons: evaluation.result.reviewReasons.join(" | "),
		};
	}

	return {
		...base,
		proposed_outcome: "classified",
		proposed_status: "published",
		proposed_difficulty: evaluation.result.classification.difficultyLevel,
		proposed_beginner_score: evaluation.result.classification.beginnerScore,
		proposed_classification_version: evaluation.result.classificationVersion,
		difficulty_change: compareDifficulty(
			paper.classification?.difficultyLevel ?? null,
			evaluation.result.classification.difficultyLevel,
		),
		review_reasons: "",
	};
}

function createBackupRow(
	paper: EligiblePaper,
): CsvRow<(typeof BACKUP_COLUMNS)[number]> {
	const classification = paper.classification;
	return {
		paper_id: paper.id,
		title: paper.title,
		current_status: paper.status,
		classification_id: classification?.id,
		difficulty_level: classification?.difficultyLevel,
		beginner_score: classification?.beginnerScore,
		estimated_reading_time: classification?.estimatedReadingTime,
		abstract_length_score: classification?.abstractLengthScore,
		sentence_complexity_score: classification?.sentenceComplexityScore,
		jargon_density_score: classification?.jargonDensityScore,
		methodology_complexity_score: classification?.methodologyComplexityScore,
		statistical_complexity_score: classification?.statisticalComplexityScore,
		prerequisite_score: classification?.prerequisiteScore,
		clarity_score: classification?.clarityScore,
		classification_reason: classification?.classificationReason,
		reading_warning: classification?.readingWarning,
		recommended_reader: classification?.recommendedReader,
		classification_version: classification?.classificationVersion,
		classification_created_at: classification?.createdAt.toISOString(),
		classification_updated_at: classification?.updatedAt.toISOString(),
	};
}

function printSummary(summary: Summary, outputPath: string) {
	console.log(`total scanned: ${summary.totalScanned}`);
	console.log(`total eligible: ${summary.totalEligible}`);
	console.log(`already v2.1.4: ${summary.alreadyCurrent}`);
	console.log(`skipped inactive: ${summary.skippedInactive}`);
	console.log(`skipped rejected: ${summary.skippedRejected}`);
	console.log(`would remain published: ${summary.wouldRemainPublished}`);
	console.log(`would become published: ${summary.wouldBecomePublished}`);
	console.log(`would become needs_review: ${summary.wouldBecomeNeedsReview}`);
	console.log(`difficulty unchanged: ${summary.difficultyUnchanged}`);
	console.log(`difficulty changed: ${summary.difficultyChanged}`);
	console.log(`successful: ${summary.successful}`);
	console.log(`failed: ${summary.failed}`);
	console.log(`preview or backup file path: ${outputPath}`);
}

const args = process.argv.slice(2);
const applyMode = args.length === 1 && args[0] === "--apply";

if (args.length > 0 && !applyMode) {
	console.error("Invalid arguments. Use no arguments for dry-run or exactly --apply to write changes.");
	process.exit(1);
}

const envStatus = loadServerEnv();
if (!envStatus.ok) {
	console.error("Legacy reclassification could not start because database environment is unavailable.");
	console.error(`Missing required value(s): ${envStatus.missing.join(", ")}`);
	process.exit(1);
}

console.log(
	applyMode
		? "APPLY MODE: backing up and reclassifying eligible legacy papers."
		: "DRY RUN: previewing legacy reclassification. No database writes will be performed.",
);

const { classifyPaperDifficultyV2 } = await import(
	"@deepread/api/services/difficulty-classifier"
);
const { default: prisma } = await import("@deepread/db");

try {
	const [totalScanned, skippedInactive, skippedRejected, alreadyCurrent, papers] =
		await Promise.all([
			prisma.paper.count(),
			prisma.paper.count({ where: { status: "inactive" } }),
			prisma.paper.count({ where: { status: "rejected" } }),
			prisma.paper.count({
				where: {
					status: { in: [...ELIGIBLE_STATUSES] },
					classification: {
						is: { classificationVersion: TARGET_CLASSIFICATION_VERSION },
					},
				},
			}),
			prisma.paper.findMany({
				where: {
					status: { in: [...ELIGIBLE_STATUSES] },
					OR: [
						{ classification: { is: null } },
						{
							classification: {
								is: { classificationVersion: { not: TARGET_CLASSIFICATION_VERSION } },
							},
						},
					],
				},
				orderBy: { id: "asc" },
				select: {
					id: true,
					title: true,
					abstract: true,
					keywords: true,
					publicationYear: true,
					status: true,
					category: { select: { name: true } },
					classification: true,
					_count: {
						select: { bookmarks: true, readingProgress: true, readingNotes: true },
					},
				},
			}),
		]);

	const eligiblePapers = papers as EligiblePaper[];
	const summary = createSummary({
		totalScanned,
		totalEligible: eligiblePapers.length,
		alreadyCurrent,
		skippedInactive,
		skippedRejected,
	});

	let outputPath = previewPath;
	if (applyMode) {
		outputPath = getBackupPath();
		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(
			outputPath,
			serializeCsv(BACKUP_COLUMNS, eligiblePapers.map(createBackupRow)),
			"utf8",
		);
	}

	const evaluations: Evaluation[] = eligiblePapers.map((paper) => {
		try {
			const result = classifyPaperDifficultyV2({
				title: paper.title,
				abstract: paper.abstract,
				keywords: toKeywords(paper.keywords),
				categoryName: paper.category.name,
				publicationYear: paper.publicationYear,
			});

			if (result.classificationVersion !== TARGET_CLASSIFICATION_VERSION) {
				throw new Error("Classifier returned an unexpected version.");
			}

			return { status: "evaluated", paper, result };
		} catch (error) {
			return {
				status: "failed",
				paper,
				error: getSafeError(error, "Classification evaluation failed."),
			};
		}
	});

	for (const evaluation of evaluations) {
		updateProposalSummary(summary, evaluation);
	}

	if (!applyMode) {
		await mkdir(dirname(previewPath), { recursive: true });
		await writeFile(
			previewPath,
			serializeCsv(PREVIEW_COLUMNS, evaluations.map(createPreviewRow)),
			"utf8",
		);
		printSummary(summary, previewPath);
	} else {
		summary.successful = 0;
		summary.failed = evaluations.filter((evaluation) => evaluation.status === "failed").length;

		for (const batch of chunk(evaluations, BATCH_SIZE)) {
			for (const evaluation of batch) {
				if (evaluation.status === "failed") {
					continue;
				}

				try {
					const applied = await prisma.$transaction(async (tx) => {
						const current = await tx.paper.findUnique({
							where: { id: evaluation.paper.id },
							select: {
								status: true,
								classification: { select: { classificationVersion: true } },
							},
						});

						if (
							!current ||
							!ELIGIBLE_STATUSES.includes(
								current.status as (typeof ELIGIBLE_STATUSES)[number],
							) ||
							current.classification?.classificationVersion === TARGET_CLASSIFICATION_VERSION
						) {
							return false;
						}

						if (evaluation.result.outcome === "needs_review") {
							await tx.paperClassification.deleteMany({
								where: { paperId: evaluation.paper.id },
							});
							await tx.paper.update({
								where: { id: evaluation.paper.id },
								data: { status: "needs_review" },
							});
							return true;
						}

						const classificationData = getClassificationData(
							evaluation.result.classification,
						);
						await tx.paperClassification.upsert({
							where: { paperId: evaluation.paper.id },
							update: classificationData,
							create: { paperId: evaluation.paper.id, ...classificationData },
						});
						await tx.paper.update({
							where: { id: evaluation.paper.id },
							data: { status: "published" },
						});
						return true;
					});

					if (applied) {
						summary.successful += 1;
					}
				} catch {
					summary.failed += 1;
				}
			}
		}

		printSummary(summary, outputPath);
	}
} catch (error) {
	console.error(getSafeError(error, "Legacy reclassification failed before completion."));
	process.exitCode = 1;
} finally {
	await prisma.$disconnect();
}
