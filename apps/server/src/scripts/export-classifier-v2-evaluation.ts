import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
	ClassifierV2Diagnostics,
	DifficultyLevel,
} from "@deepread/api/services/difficulty-classifier";

import { getScriptErrorMessage, loadServerEnv } from "./load-server-env";

const CSV_COLUMNS = [
	"paper_id",
	"title",
	"abstract",
	"category_name",
	"publication_year",
	"paper_status",
	"source_url",
	"pdf_url",
	"stored_classification_version",
	"stored_difficulty",
	"stored_beginner_score",
	"v1_difficulty",
	"v1_beginner_score",
	"v2_outcome",
	"v2_difficulty",
	"v2_beginner_score",
	"v2_estimated_reading_time",
	"v2_abstract_length_score",
	"v2_sentence_complexity_score",
	"v2_jargon_density_score",
	"v2_methodology_complexity_score",
	"v2_statistical_complexity_score",
	"v2_prerequisite_score",
	"v2_clarity_score",
	"v2_classification_reason",
	"v2_reading_warning",
	"v2_recommended_reader",
	"quality_gate_reasons",
	"quality_word_count",
	"quality_method_signal_count",
	"quality_result_signal_count",
	"quality_vague_signal_count",
	"quality_metadata_only_signal_count",
	"difficulty_change",
	"manual_label",
	"manual_notes",
	"diagnostic_normalized_category",
	"diagnostic_matched_methodology_terms",
	"diagnostic_matched_statistical_terms",
	"diagnostic_matched_technical_terms",
	"diagnostic_matched_prerequisite_terms",
	"diagnostic_matched_jargon_terms",
	"diagnostic_matched_acronyms",
	"diagnostic_matched_category_neutral_terms",
	"diagnostic_matched_category_strong_terms",
	"diagnostic_matched_advanced_signal_groups",
	"diagnostic_abstract_length_penalty",
	"diagnostic_sentence_complexity_penalty",
	"diagnostic_jargon_penalty",
	"diagnostic_methodology_penalty",
	"diagnostic_statistical_penalty",
	"diagnostic_prerequisite_penalty",
	"diagnostic_clarity_penalty",
	"diagnostic_base_total_penalty",
	"diagnostic_complexity_adjustment",
	"diagnostic_beginner_eligibility_adjustment",
	"diagnostic_final_total_penalty",
	"diagnostic_preliminary_beginner_score",
	"diagnostic_final_beginner_score",
	"diagnostic_preliminary_difficulty",
	"diagnostic_final_difficulty",
	"diagnostic_beginner_eligible",
	"diagnostic_quality_gate_should_review",
] as const;

const DIFFICULTY_LEVELS: DifficultyLevel[] = [
	"beginner_friendly",
	"moderate",
	"difficult",
	"expert",
];
const DIFFICULTY_RANK: Record<DifficultyLevel, number> = {
	beginner_friendly: 0,
	moderate: 1,
	difficult: 2,
	expert: 3,
};
const outputPath = resolve(
	import.meta.dir,
	"../../../..",
	"tmp",
	"classifier-v2.1.4-diagnostics.csv",
);

type CsvColumn = (typeof CSV_COLUMNS)[number];
type CsvValue = string | number | boolean | null | undefined;
type CsvRow = Record<CsvColumn, CsvValue>;

function escapeCsvField(value: CsvValue): string {
	if (value === null || value === undefined) {
		return "";
	}

	const text = String(value);
	return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function serializeCsv(rows: CsvRow[]): string {
	const lines = [
		CSV_COLUMNS.join(","),
		...rows.map((row) =>
			CSV_COLUMNS.map((column) => escapeCsvField(row[column])).join(","),
		),
	];

	return `${lines.join("\r\n")}\r\n`;
}

function toKeywords(value: unknown): string[] {
	return Array.isArray(value)
		? value.filter((item): item is string => typeof item === "string")
		: [];
}

function compareDifficulty(v1: DifficultyLevel, v2: DifficultyLevel): CsvValue {
	const difference = DIFFICULTY_RANK[v2] - DIFFICULTY_RANK[v1];

	if (difference === 0) return "same";
	if (difference === 1) return "one_level_harder";
	if (difference === -1) return "one_level_easier";
	if (difference > 1) return "two_or_more_levels_harder";
	return "two_or_more_levels_easier";
}

function emptyDistribution(): Record<DifficultyLevel, number> {
	return {
		beginner_friendly: 0,
		moderate: 0,
		difficult: 0,
		expert: 0,
	};
}

function formatDistribution(
	distribution: Record<DifficultyLevel, number>,
): string {
	return DIFFICULTY_LEVELS.map(
		(level) => `${level}=${distribution[level]}`,
	).join(", ");
}

function diagnosticCsvFields(diagnostics: ClassifierV2Diagnostics) {
	return {
		diagnostic_normalized_category: diagnostics.normalizedCategory,
		diagnostic_matched_methodology_terms: JSON.stringify(
			diagnostics.matchedMethodologyTerms,
		),
		diagnostic_matched_statistical_terms: JSON.stringify(
			diagnostics.matchedStatisticalTerms,
		),
		diagnostic_matched_technical_terms: JSON.stringify(
			diagnostics.matchedTechnicalTerms,
		),
		diagnostic_matched_prerequisite_terms: JSON.stringify(
			diagnostics.matchedPrerequisiteTerms,
		),
		diagnostic_matched_jargon_terms: JSON.stringify(
			diagnostics.matchedJargonTerms,
		),
		diagnostic_matched_acronyms: JSON.stringify(diagnostics.matchedAcronyms),
		diagnostic_matched_category_neutral_terms: JSON.stringify(
			diagnostics.matchedCategoryNeutralTerms,
		),
		diagnostic_matched_category_strong_terms: JSON.stringify(
			diagnostics.matchedCategoryStrongTerms,
		),
		diagnostic_matched_advanced_signal_groups: JSON.stringify(
			diagnostics.matchedAdvancedSignalGroups,
		),
		diagnostic_abstract_length_penalty:
			diagnostics.abstractLengthPenalty,
		diagnostic_sentence_complexity_penalty:
			diagnostics.sentenceComplexityPenalty,
		diagnostic_jargon_penalty: diagnostics.jargonPenalty,
		diagnostic_methodology_penalty: diagnostics.methodologyPenalty,
		diagnostic_statistical_penalty: diagnostics.statisticalPenalty,
		diagnostic_prerequisite_penalty: diagnostics.prerequisitePenalty,
		diagnostic_clarity_penalty: diagnostics.clarityPenalty,
		diagnostic_base_total_penalty: diagnostics.baseTotalPenalty,
		diagnostic_complexity_adjustment: diagnostics.complexityAdjustment,
		diagnostic_beginner_eligibility_adjustment:
			diagnostics.beginnerEligibilityAdjustment,
		diagnostic_final_total_penalty: diagnostics.finalTotalPenalty,
		diagnostic_preliminary_beginner_score:
			diagnostics.preliminaryBeginnerScore,
		diagnostic_final_beginner_score: diagnostics.finalBeginnerScore,
		diagnostic_preliminary_difficulty: diagnostics.preliminaryDifficulty,
		diagnostic_final_difficulty: diagnostics.finalDifficulty,
		diagnostic_beginner_eligible: diagnostics.beginnerEligible,
		diagnostic_quality_gate_should_review:
			diagnostics.qualityGateShouldReview,
	};
}

const envStatus = loadServerEnv();

if (!envStatus.ok) {
	console.error(
		"DEV ONLY: Classifier evaluation export skipped. Database environment is not ready.",
	);
	console.error(`Loaded env file: ${envStatus.envPath}`);
	console.error(`Missing required value(s): ${envStatus.missing.join(", ")}`);
	if (envStatus.error) {
		console.error(`dotenv error: ${envStatus.error.message}`);
	}
	process.exit(1);
}

console.log(
	"DEV ONLY: Exporting read-only classifier v2.1.4 diagnostics. No database writes are performed.",
);

try {
	const {
		classifyPaperDifficulty,
		classifyPaperDifficultyV2,
		classifyPaperDifficultyV2WithDiagnostics,
	} = await import("@deepread/api/services/difficulty-classifier");
	const { default: prisma } = await import("@deepread/db");

	try {
		const papers = await prisma.paper.findMany({
			where: {
				classification: {
					isNot: null,
				},
			},
			orderBy: {
				id: "asc",
			},
			select: {
				id: true,
				title: true,
				abstract: true,
				keywords: true,
				publicationYear: true,
				status: true,
				sourceUrl: true,
				pdfUrl: true,
				category: {
					select: {
						name: true,
					},
				},
				classification: {
					select: {
						classificationVersion: true,
						difficultyLevel: true,
						beginnerScore: true,
					},
				},
			},
		});

		const rows: CsvRow[] = [];
		const v2Distribution = emptyDistribution();
		let needsReview = 0;
		let classifiedCount = 0;
		let finalPenaltyTotal = 0;
		let finalScoreTotal = 0;
		let zeroMethodologyPenalty = 0;
		let zeroStatisticalPenalty = 0;
		let zeroPrerequisitePenalty = 0;

		for (const paper of papers) {
			if (!paper.classification) {
				continue;
			}

			const input = {
				title: paper.title,
				abstract: paper.abstract,
				keywords: toKeywords(paper.keywords),
				categoryName: paper.category.name,
				publicationYear: paper.publicationYear,
			};
			const v1 = classifyPaperDifficulty(input);
			const v2 = classifyPaperDifficultyV2(input);
			const diagnosticResult =
				classifyPaperDifficultyV2WithDiagnostics(input);

			if (JSON.stringify(v2) !== JSON.stringify(diagnosticResult.result)) {
				throw new Error(
					`Diagnostic result differs from normal v2 result for paper ${paper.id}.`,
				);
			}

			const diagnostics = diagnosticResult.diagnostics;
			const quality = v2.qualityGate.signals;

			if (v2.outcome === "needs_review") {
				needsReview += 1;
				rows.push({
					paper_id: paper.id,
					title: paper.title,
					abstract: paper.abstract,
					category_name: paper.category.name,
					publication_year: paper.publicationYear,
					paper_status: paper.status,
					source_url: paper.sourceUrl,
					pdf_url: paper.pdfUrl,
					stored_classification_version:
						paper.classification.classificationVersion,
					stored_difficulty: paper.classification.difficultyLevel,
					stored_beginner_score: paper.classification.beginnerScore,
					v1_difficulty: v1.difficultyLevel,
					v1_beginner_score: v1.beginnerScore,
					v2_outcome: v2.outcome,
					v2_difficulty: "",
					v2_beginner_score: "",
					v2_estimated_reading_time: "",
					v2_abstract_length_score: "",
					v2_sentence_complexity_score: "",
					v2_jargon_density_score: "",
					v2_methodology_complexity_score: "",
					v2_statistical_complexity_score: "",
					v2_prerequisite_score: "",
					v2_clarity_score: "",
					v2_classification_reason: "",
					v2_reading_warning: "",
					v2_recommended_reader: "",
					quality_gate_reasons: v2.reviewReasons.join(" | "),
					quality_word_count: quality.wordCount,
					quality_method_signal_count: quality.methodSignalCount,
					quality_result_signal_count: quality.resultSignalCount,
					quality_vague_signal_count: quality.vagueSignalCount,
					quality_metadata_only_signal_count: quality.metadataOnlySignalCount,
					difficulty_change: "needs_review",
					manual_label: "",
					manual_notes: "",
					...diagnosticCsvFields(diagnostics),
				});
				continue;
			}

			const classification = v2.classification;
			const difficultyChange = compareDifficulty(
				v1.difficultyLevel,
				classification.difficultyLevel,
			);

			v2Distribution[classification.difficultyLevel] += 1;
			classifiedCount += 1;
			finalPenaltyTotal += diagnostics.finalTotalPenalty ?? 0;
			finalScoreTotal += diagnostics.finalBeginnerScore ?? 0;
			if (diagnostics.methodologyPenalty === 0) zeroMethodologyPenalty += 1;
			if (diagnostics.statisticalPenalty === 0) zeroStatisticalPenalty += 1;
			if (diagnostics.prerequisitePenalty === 0) zeroPrerequisitePenalty += 1;

			rows.push({
				paper_id: paper.id,
				title: paper.title,
				abstract: paper.abstract,
				category_name: paper.category.name,
				publication_year: paper.publicationYear,
				paper_status: paper.status,
				source_url: paper.sourceUrl,
				pdf_url: paper.pdfUrl,
				stored_classification_version:
					paper.classification.classificationVersion,
				stored_difficulty: paper.classification.difficultyLevel,
				stored_beginner_score: paper.classification.beginnerScore,
				v1_difficulty: v1.difficultyLevel,
				v1_beginner_score: v1.beginnerScore,
				v2_outcome: v2.outcome,
				v2_difficulty: classification.difficultyLevel,
				v2_beginner_score: classification.beginnerScore,
				v2_estimated_reading_time: classification.estimatedReadingTime,
				v2_abstract_length_score: classification.scores.abstractLengthScore,
				v2_sentence_complexity_score:
					classification.scores.sentenceComplexityScore,
				v2_jargon_density_score: classification.scores.jargonDensityScore,
				v2_methodology_complexity_score:
					classification.scores.methodologyComplexityScore,
				v2_statistical_complexity_score:
					classification.scores.statisticalComplexityScore,
				v2_prerequisite_score: classification.scores.prerequisiteScore,
				v2_clarity_score: classification.scores.clarityScore,
				v2_classification_reason: classification.classificationReason,
				v2_reading_warning: classification.readingWarning,
				v2_recommended_reader: classification.recommendedReader,
				quality_gate_reasons: v2.qualityGate.reasons.join(" | "),
				quality_word_count: quality.wordCount,
				quality_method_signal_count: quality.methodSignalCount,
				quality_result_signal_count: quality.resultSignalCount,
				quality_vague_signal_count: quality.vagueSignalCount,
				quality_metadata_only_signal_count: quality.metadataOnlySignalCount,
				difficulty_change: difficultyChange,
				manual_label: "",
				manual_notes: "",
				...diagnosticCsvFields(diagnostics),
			});
		}

		await mkdir(dirname(outputPath), { recursive: true });
		await writeFile(outputPath, serializeCsv(rows), "utf8");

		console.log(`total papers evaluated: ${rows.length}`);
		console.log(
			`v2.1.4 difficulty distribution: ${formatDistribution(v2Distribution)}`,
		);
		console.log(`total needs_review: ${needsReview}`);
		console.log(
			`average final penalty: ${classifiedCount > 0 ? (finalPenaltyTotal / classifiedCount).toFixed(2) : "0.00"}`,
		);
		console.log(
			`average score: ${classifiedCount > 0 ? (finalScoreTotal / classifiedCount).toFixed(2) : "0.00"}`,
		);
		console.log(
			`papers with zero methodology penalty: ${zeroMethodologyPenalty}`,
		);
		console.log(
			`papers with zero statistical penalty: ${zeroStatisticalPenalty}`,
		);
		console.log(
			`papers with zero prerequisite penalty: ${zeroPrerequisitePenalty}`,
		);
		console.log(`output file path: ${outputPath}`);
	} finally {
		await prisma.$disconnect();
	}
} catch (error) {
	console.error("DEV ONLY: Classifier evaluation export failed.");
	console.error(
		"Check apps/server/.env DATABASE_URL and database connectivity.",
	);
	console.error(getScriptErrorMessage(error));
	process.exitCode = 1;
}
