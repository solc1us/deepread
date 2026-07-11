import { getCategoryProfile } from "./category-profiles";
import {
  buildClassificationReasonV2,
  buildReadingWarningV2,
  buildRecommendedReader,
  formatReviewReasons,
} from "./messages";
import { runQualityGate } from "./quality-gate";
import {
  estimateReadingTimeV2,
  getDifficultyLevelV2,
  scorePaperDifficultyV2,
  type NormalizedV2Input,
} from "./scoring";
import { normalizeText, tokenizeWords } from "./text-utils";
import type { ClassifyPaperDifficultyInput, PaperDifficultyV2Result } from "./types";

const CLASSIFICATION_VERSION = "rule-based-v2.1" as const;

function normalizeV2Input(input: ClassifyPaperDifficultyInput): NormalizedV2Input {
  const title = input.title.trim();
  const abstract = input.abstract.trim();
  const keywords = (input.keywords ?? []).map((keyword) => keyword.trim()).filter(Boolean);
  const categoryName = input.categoryName?.trim() || undefined;
  const combinedText = [title, abstract, keywords.join(" "), categoryName ?? ""].filter(Boolean).join(" ");

  return {
    title,
    abstract,
    keywords,
    categoryName,
    publicationYear: input.publicationYear,
    combinedText,
    normalizedText: normalizeText(combinedText),
  };
}

export function classifyPaperDifficultyV2(input: ClassifyPaperDifficultyInput): PaperDifficultyV2Result {
  const normalizedInput = normalizeV2Input(input);
  const qualityGate = runQualityGate(normalizedInput);

  if (qualityGate.shouldReview) {
    return {
      outcome: "needs_review",
      reviewReasons: formatReviewReasons(qualityGate.reasons),
      qualityGate,
      classificationVersion: CLASSIFICATION_VERSION,
    };
  }

  const scoring = scorePaperDifficultyV2(normalizedInput, getCategoryProfile(normalizedInput.categoryName));
  const difficultyLevel = getDifficultyLevelV2(scoring.beginnerScore);
  const titleWordCount = tokenizeWords(normalizedInput.title).length;

  return {
    outcome: "classified",
    classification: {
      difficultyLevel,
      beginnerScore: scoring.beginnerScore,
      estimatedReadingTime: estimateReadingTimeV2(scoring.abstractWordCount + titleWordCount, difficultyLevel),
      scores: scoring.scores,
      classificationReason: buildClassificationReasonV2(difficultyLevel, scoring.beginnerScore, scoring.drivers),
      readingWarning: buildReadingWarningV2(difficultyLevel, scoring.drivers),
      recommendedReader: buildRecommendedReader(difficultyLevel),
    },
    qualityGate,
    classificationVersion: CLASSIFICATION_VERSION,
  };
}
