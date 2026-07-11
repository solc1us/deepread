import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type { DifficultyLevel } from "@deepread/api/services/difficulty-classifier";

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
] as const;

const DIFFICULTY_LEVELS: DifficultyLevel[] = ["beginner_friendly", "moderate", "difficult", "expert"];
const DIFFICULTY_RANK: Record<DifficultyLevel, number> = {
  beginner_friendly: 0,
  moderate: 1,
  difficult: 2,
  expert: 3,
};
const outputPath = resolve(import.meta.dir, "../../../..", "tmp", "classifier-v2-evaluation.csv");

type CsvColumn = (typeof CSV_COLUMNS)[number];
type CsvValue = string | number | null | undefined;
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
    ...rows.map((row) => CSV_COLUMNS.map((column) => escapeCsvField(row[column])).join(",")),
  ];

  return `${lines.join("\r\n")}\r\n`;
}

function toKeywords(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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

function formatDistribution(distribution: Record<DifficultyLevel, number>): string {
  return DIFFICULTY_LEVELS.map((level) => `${level}=${distribution[level]}`).join(", ");
}

const envStatus = loadServerEnv();

if (!envStatus.ok) {
  console.error("DEV ONLY: Classifier evaluation export skipped. Database environment is not ready.");
  console.error(`Loaded env file: ${envStatus.envPath}`);
  console.error(`Missing required value(s): ${envStatus.missing.join(", ")}`);
  if (envStatus.error) {
    console.error(`dotenv error: ${envStatus.error.message}`);
  }
  process.exit(1);
}

console.log("DEV ONLY: Exporting a read-only classifier v1/v2 evaluation. No database writes are performed.");

try {
  const { classifyPaperDifficulty, classifyPaperDifficultyV2 } = await import(
    "@deepread/api/services/difficulty-classifier"
  );
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
    const v1Distribution = emptyDistribution();
    const v2Distribution = emptyDistribution();
    let needsReview = 0;
    let sameDifficulty = 0;
    let harderInV2 = 0;
    let easierInV2 = 0;

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
      const quality = v2.qualityGate.signals;

      v1Distribution[v1.difficultyLevel] += 1;

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
          stored_classification_version: paper.classification.classificationVersion,
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
        });
        continue;
      }

      const classification = v2.classification;
      const difficultyChange = compareDifficulty(v1.difficultyLevel, classification.difficultyLevel);

      v2Distribution[classification.difficultyLevel] += 1;
      if (difficultyChange === "same") sameDifficulty += 1;
      else if (DIFFICULTY_RANK[classification.difficultyLevel] > DIFFICULTY_RANK[v1.difficultyLevel]) {
        harderInV2 += 1;
      } else {
        easierInV2 += 1;
      }

      rows.push({
        paper_id: paper.id,
        title: paper.title,
        abstract: paper.abstract,
        category_name: paper.category.name,
        publication_year: paper.publicationYear,
        paper_status: paper.status,
        source_url: paper.sourceUrl,
        pdf_url: paper.pdfUrl,
        stored_classification_version: paper.classification.classificationVersion,
        stored_difficulty: paper.classification.difficultyLevel,
        stored_beginner_score: paper.classification.beginnerScore,
        v1_difficulty: v1.difficultyLevel,
        v1_beginner_score: v1.beginnerScore,
        v2_outcome: v2.outcome,
        v2_difficulty: classification.difficultyLevel,
        v2_beginner_score: classification.beginnerScore,
        v2_estimated_reading_time: classification.estimatedReadingTime,
        v2_abstract_length_score: classification.scores.abstractLengthScore,
        v2_sentence_complexity_score: classification.scores.sentenceComplexityScore,
        v2_jargon_density_score: classification.scores.jargonDensityScore,
        v2_methodology_complexity_score: classification.scores.methodologyComplexityScore,
        v2_statistical_complexity_score: classification.scores.statisticalComplexityScore,
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
      });
    }

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serializeCsv(rows), "utf8");

    console.log(`total papers evaluated: ${rows.length}`);
    console.log(`v1 distribution: ${formatDistribution(v1Distribution)}`);
    console.log(`v2 classified distribution: ${formatDistribution(v2Distribution)}`);
    console.log(`total needs_review: ${needsReview}`);
    console.log(`same difficulty count: ${sameDifficulty}`);
    console.log(`harder in v2 count: ${harderInV2}`);
    console.log(`easier in v2 count: ${easierInV2}`);
    console.log(`output file path: ${outputPath}`);
  } finally {
    await prisma.$disconnect();
  }
} catch (error) {
  console.error("DEV ONLY: Classifier evaluation export failed.");
  console.error("Check apps/server/.env DATABASE_URL and database connectivity.");
  console.error(getScriptErrorMessage(error));
  process.exitCode = 1;
}
