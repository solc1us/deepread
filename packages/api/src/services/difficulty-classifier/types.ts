export type DifficultyLevel = "beginner_friendly" | "moderate" | "difficult" | "expert";

export interface ClassifyPaperDifficultyInput {
  title: string;
  abstract: string;
  keywords?: string[];
  categoryName?: string;
  publicationYear?: number | null;
}

export interface PaperDifficultyScores {
  abstractLengthScore: number;
  sentenceComplexityScore: number;
  jargonDensityScore: number;
  methodologyComplexityScore: number;
  statisticalComplexityScore: number;
  prerequisiteScore: number;
  clarityScore: number;
}

export interface PaperDifficultyClassification {
  difficultyLevel: DifficultyLevel;
  beginnerScore: number;
  estimatedReadingTime: number;
  scores: PaperDifficultyScores;
  classificationReason: string;
  readingWarning: string;
  recommendedReader: string;
}

export interface IndicatorResult {
  penalty: number;
  score: number;
}

export interface QualityGateResult {
  shouldReview: boolean;
  reasons: string[];
  signals: {
    wordCount: number;
    methodSignalCount: number;
    resultSignalCount: number;
    vagueSignalCount: number;
    metadataOnlySignalCount: number;
  };
}

export type PaperDifficultyV2Result =
  | {
      outcome: "classified";
      classification: PaperDifficultyClassification;
      qualityGate: QualityGateResult;
      classificationVersion: "rule-based-v2.1.4";
    }
  | {
      outcome: "needs_review";
      reviewReasons: string[];
      qualityGate: QualityGateResult;
      classificationVersion: "rule-based-v2.1.4";
    };

export interface ClassifierV2Diagnostics {
  normalizedCategory: string;
  matchedMethodologyTerms: string[];
  matchedStatisticalTerms: string[];
  matchedTechnicalTerms: string[];
  matchedPrerequisiteTerms: string[];
  matchedJargonTerms: string[];
  matchedAcronyms: string[];
  matchedCategoryNeutralTerms: string[];
  matchedCategoryStrongTerms: string[];
  matchedAdvancedSignalGroups: string[];
  abstractLengthPenalty: number | null;
  sentenceComplexityPenalty: number | null;
  jargonPenalty: number | null;
  methodologyPenalty: number | null;
  statisticalPenalty: number | null;
  prerequisitePenalty: number | null;
  clarityPenalty: number | null;
  baseTotalPenalty: number | null;
  complexityAdjustment: number | null;
  beginnerEligibilityAdjustment: number | null;
  finalTotalPenalty: number | null;
  preliminaryBeginnerScore: number | null;
  finalBeginnerScore: number | null;
  preliminaryDifficulty: DifficultyLevel | null;
  finalDifficulty: DifficultyLevel | null;
  beginnerEligible: boolean | null;
  qualityGateShouldReview: boolean;
}

export interface PaperDifficultyV2WithDiagnosticsResult {
  result: PaperDifficultyV2Result;
  diagnostics: ClassifierV2Diagnostics;
}
