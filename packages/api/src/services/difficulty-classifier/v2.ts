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
import type {
  ClassifierV2Diagnostics,
  ClassifyPaperDifficultyInput,
  PaperDifficultyV2Result,
  PaperDifficultyV2WithDiagnosticsResult,
} from "./types";

const CLASSIFICATION_VERSION = "rule-based-v2.1.3" as const;

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

function createReviewDiagnostics(
  normalizedInput: NormalizedV2Input,
  qualityGateShouldReview: boolean,
): ClassifierV2Diagnostics {
  return {
    normalizedCategory: normalizeText(normalizedInput.categoryName ?? ""),
    matchedMethodologyTerms: [],
    matchedStatisticalTerms: [],
    matchedTechnicalTerms: [],
    matchedPrerequisiteTerms: [],
    matchedJargonTerms: [],
    matchedAcronyms: [],
    matchedCategoryNeutralTerms: [],
    matchedCategoryStrongTerms: [],
    matchedAdvancedSignalGroups: [],
    abstractLengthPenalty: null,
    sentenceComplexityPenalty: null,
    jargonPenalty: null,
    methodologyPenalty: null,
    statisticalPenalty: null,
    prerequisitePenalty: null,
    clarityPenalty: null,
    baseTotalPenalty: null,
    complexityAdjustment: null,
    beginnerEligibilityAdjustment: null,
    finalTotalPenalty: null,
    preliminaryBeginnerScore: null,
    finalBeginnerScore: null,
    preliminaryDifficulty: null,
    finalDifficulty: null,
    beginnerEligible: null,
    qualityGateShouldReview,
  };
}

function calculatePaperDifficultyV2(input: ClassifyPaperDifficultyInput): PaperDifficultyV2WithDiagnosticsResult {
  const normalizedInput = normalizeV2Input(input);
  const qualityGate = runQualityGate(normalizedInput);

  if (qualityGate.shouldReview) {
    return {
      result: {
        outcome: "needs_review",
        reviewReasons: formatReviewReasons(qualityGate.reasons),
        qualityGate,
        classificationVersion: CLASSIFICATION_VERSION,
      },
      diagnostics: createReviewDiagnostics(normalizedInput, qualityGate.shouldReview),
    };
  }

  const scoring = scorePaperDifficultyV2(normalizedInput, getCategoryProfile(normalizedInput.categoryName));
  const difficultyLevel = getDifficultyLevelV2(scoring.beginnerScore);
  const titleWordCount = tokenizeWords(normalizedInput.title).length;
  const result: PaperDifficultyV2Result = {
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

  return {
    result,
    diagnostics: {
      normalizedCategory: normalizeText(normalizedInput.categoryName ?? ""),
      matchedMethodologyTerms: scoring.indicators.methodologyComplexity.matchedTerms,
      matchedStatisticalTerms: scoring.indicators.statisticalComplexity.matchedTerms,
      matchedTechnicalTerms: scoring.matchedTechnicalTerms,
      matchedPrerequisiteTerms: scoring.indicators.prerequisiteComplexity.matchedTerms,
      matchedJargonTerms: scoring.matchedJargonTerms,
      matchedAcronyms: scoring.matchedAcronyms,
      matchedCategoryNeutralTerms: scoring.matchedCategoryNeutralTerms,
      matchedCategoryStrongTerms: scoring.categoryStrongTerms,
      matchedAdvancedSignalGroups: scoring.advancedSignalGroups,
      abstractLengthPenalty: scoring.indicators.abstractLength.penalty,
      sentenceComplexityPenalty: scoring.indicators.sentenceComplexity.penalty,
      jargonPenalty: scoring.indicators.jargonDensity.penalty,
      methodologyPenalty: scoring.indicators.methodologyComplexity.penalty,
      statisticalPenalty: scoring.indicators.statisticalComplexity.penalty,
      prerequisitePenalty: scoring.indicators.prerequisiteComplexity.penalty,
      clarityPenalty: scoring.indicators.clarity.penalty,
      baseTotalPenalty: scoring.baseTotalPenalty,
      complexityAdjustment: scoring.complexityAdjustment,
      beginnerEligibilityAdjustment: scoring.beginnerEligibilityAdjustment,
      finalTotalPenalty: scoring.finalTotalPenalty,
      preliminaryBeginnerScore: scoring.preliminaryBeginnerScore,
      finalBeginnerScore: scoring.beginnerScore,
      preliminaryDifficulty: getDifficultyLevelV2(scoring.preliminaryBeginnerScore),
      finalDifficulty: difficultyLevel,
      beginnerEligible: scoring.beginnerEligible,
      qualityGateShouldReview: qualityGate.shouldReview,
    },
  };
}

export function classifyPaperDifficultyV2(input: ClassifyPaperDifficultyInput): PaperDifficultyV2Result {
  return calculatePaperDifficultyV2(input).result;
}

export function classifyPaperDifficultyV2WithDiagnostics(
  input: ClassifyPaperDifficultyInput,
): PaperDifficultyV2WithDiagnosticsResult {
  return calculatePaperDifficultyV2(input);
}
