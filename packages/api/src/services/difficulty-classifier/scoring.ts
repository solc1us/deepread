import type { CategoryProfile } from "./category-profiles";
import {
  ADVANCED_SIGNAL_GROUPS,
  BIBLIOMETRIC_ANALYSIS_VARIANTS,
  INTERRUPTED_TIME_SERIES_VARIANTS,
  LIKELIHOOD_ESTIMATION_VARIANTS,
  MATERIAL_SEMIOTIC_VARIANTS,
  SENSITIVITY_ANALYSIS_VARIANTS,
  V2_ACADEMIC_JARGON_TERMS,
  V2_ADVANCED_TECHNICAL_TERMS,
  V2_COMPLEX_METHODOLOGY_TERMS,
  V2_PREREQUISITE_TERMS,
  V2_STATISTICAL_TERMS,
  VAGUE_PHRASES,
} from "./terms";
import {
  clamp,
  getAcronymMatches,
  getNonOverlappingTermMatches,
  splitSentences,
  tokenizeWords,
} from "./text-utils";
import type { ClassifyPaperDifficultyInput, DifficultyLevel, PaperDifficultyScores } from "./types";

export type IndicatorSeverity = "none" | "low" | "medium" | "high";

export interface ScoredIndicator {
  penalty: number;
  score: number;
  severity: IndicatorSeverity;
  matchedTerms: string[];
}

interface TermPenaltyRow {
  penalty: number;
  severity: IndicatorSeverity;
}

type TermVariantGroup = readonly string[];

const METHODOLOGY_VARIANT_GROUPS = [
  INTERRUPTED_TIME_SERIES_VARIANTS,
  BIBLIOMETRIC_ANALYSIS_VARIANTS,
] as const;
const STATISTICAL_VARIANT_GROUPS = [SENSITIVITY_ANALYSIS_VARIANTS, LIKELIHOOD_ESTIMATION_VARIANTS] as const;
const PREREQUISITE_VARIANT_GROUPS = [MATERIAL_SEMIOTIC_VARIANTS] as const;

export const V2_SCORING_CONFIG = {
  maximumPenalties: {
    abstractLength: 12,
    sentenceComplexity: 12,
    jargonDensity: 14,
    methodology: 20,
    statistical: 20,
    prerequisite: 16,
    clarity: 16,
  },
  jargonDensityWeight: 4,
  clarity: {
    vaguePhrasePenalty: 2,
    missingMetadataPenalty: 2,
  },
  termPenalties: {
    methodology: [
      { penalty: 0, severity: "none" },
      { penalty: 5, severity: "low" },
      { penalty: 10, severity: "medium" },
      { penalty: 15, severity: "high" },
      { penalty: 20, severity: "high" },
    ],
    statistical: [
      { penalty: 0, severity: "none" },
      { penalty: 4, severity: "low" },
      { penalty: 9, severity: "medium" },
      { penalty: 14, severity: "high" },
      { penalty: 20, severity: "high" },
    ],
    prerequisite: [
      { penalty: 0, severity: "none" },
      { penalty: 4, severity: "low" },
      { penalty: 8, severity: "medium" },
      { penalty: 12, severity: "high" },
      { penalty: 16, severity: "high" },
    ],
  } satisfies Record<string, TermPenaltyRow[]>,
  complexityAdjustments: {
    none: 0,
    one: 5,
    two: 12,
    threeOrMore: 20,
    threeOrMoreWithHighPrerequisite: 30,
  },
} as const;

export const V2_DIFFICULTY_THRESHOLDS = {
  beginnerFriendly: 85,
  moderate: 65,
  difficult: 45,
} as const;

export interface NormalizedV2Input extends ClassifyPaperDifficultyInput {
  keywords: string[];
  combinedText: string;
  normalizedText: string;
}

export interface V2ScoringResult {
  indicators: {
    abstractLength: ScoredIndicator;
    sentenceComplexity: ScoredIndicator;
    jargonDensity: ScoredIndicator;
    methodologyComplexity: ScoredIndicator;
    statisticalComplexity: ScoredIndicator;
    prerequisiteComplexity: ScoredIndicator;
    clarity: ScoredIndicator;
  };
  scores: PaperDifficultyScores;
  beginnerScore: number;
  preliminaryBeginnerScore: number;
  baseTotalPenalty: number;
  finalTotalPenalty: number;
  beginnerEligible: boolean;
  matchedTechnicalTerms: string[];
  matchedJargonTerms: string[];
  matchedAcronyms: string[];
  matchedCategoryNeutralTerms: string[];
  advancedSignalGroups: string[];
  categoryStrongTerms: string[];
  complexityAdjustment: number;
  beginnerEligibilityAdjustment: number;
  drivers: string[];
  abstractWordCount: number;
}

interface JargonScoringResult {
  indicator: ScoredIndicator;
  technicalTerms: string[];
  jargonTerms: string[];
  acronyms: string[];
  categoryNeutralTerms: string[];
}

function toIndicatorScore(penalty: number, maxPenalty: number) {
  return clamp(Math.round(100 - (penalty / maxPenalty) * 100));
}

function severityFromPenalty(penalty: number, maxPenalty: number): IndicatorSeverity {
  if (penalty === 0) return "none";
  if (penalty <= maxPenalty / 3) return "low";
  if (penalty <= (maxPenalty * 2) / 3) return "medium";
  return "high";
}

function toScoredIndicator(
  penalty: number,
  maxPenalty: number,
  matchedTerms: string[] = [],
  severity = severityFromPenalty(penalty, maxPenalty),
): ScoredIndicator {
  const boundedPenalty = clamp(Math.round(penalty), 0, maxPenalty);

  return {
    penalty: boundedPenalty,
    score: toIndicatorScore(boundedPenalty, maxPenalty),
    severity,
    matchedTerms,
  };
}

function scoreAbstractLength(wordCount: number): ScoredIndicator {
  const maxPenalty = V2_SCORING_CONFIG.maximumPenalties.abstractLength;
  let penalty = 0;

  if (wordCount < 100) {
    penalty = 6;
  } else if (wordCount > 350) {
    penalty = 12;
  } else if (wordCount > 280) {
    penalty = 9;
  } else if (wordCount > 220) {
    penalty = 5;
  }

  return toScoredIndicator(penalty, maxPenalty);
}

function scoreSentenceComplexity(sentences: string[], wordCount: number): ScoredIndicator {
  const maxPenalty = V2_SCORING_CONFIG.maximumPenalties.sentenceComplexity;
  const averageSentenceLength = sentences.length > 0 ? wordCount / sentences.length : wordCount;
  let penalty = 0;

  if (averageSentenceLength > 34) {
    penalty = 12;
  } else if (averageSentenceLength > 28) {
    penalty = 9;
  } else if (averageSentenceLength > 22) {
    penalty = 6;
  } else if (averageSentenceLength > 18) {
    penalty = 3;
  }

  return toScoredIndicator(penalty, maxPenalty);
}

function scoreJargon(
  normalizedText: string,
  originalText: string,
  wordCount: number,
  profile: CategoryProfile,
): JargonScoringResult {
  const maxPenalty = V2_SCORING_CONFIG.maximumPenalties.jargonDensity;
  const jargonMatches = getNonOverlappingTermMatches(normalizedText, V2_ACADEMIC_JARGON_TERMS);
  const technicalMatches = getNonOverlappingTermMatches(normalizedText, V2_ADVANCED_TECHNICAL_TERMS);
  const neutralTerms = new Set(profile.neutralJargonTerms);
  const adjustedJargon = jargonMatches.filter((term) => !neutralTerms.has(term));
  const adjustedTechnical = technicalMatches.filter((term) => !neutralTerms.has(term));
  const distinctTerms = [...new Set([...adjustedJargon, ...adjustedTechnical])];
  const acronyms = getAcronymMatches(originalText);
  const density = wordCount > 0 ? ((distinctTerms.length + acronyms.length) / wordCount) * 100 : 0;
  const penalty = density * V2_SCORING_CONFIG.jargonDensityWeight;

  return {
    indicator: toScoredIndicator(penalty, maxPenalty, distinctTerms),
    technicalTerms: adjustedTechnical,
    jargonTerms: adjustedJargon,
    acronyms,
    categoryNeutralTerms: getNonOverlappingTermMatches(normalizedText, profile.neutralJargonTerms),
  };
}

function scoreDistinctTerms(
  normalizedText: string,
  terms: string[],
  maxPenalty: number,
  penaltyTable: readonly TermPenaltyRow[],
  variantGroups: readonly TermVariantGroup[] = [],
): ScoredIndicator {
  const matches = deduplicateTargetedTermVariants(
    getNonOverlappingTermMatches(normalizedText, terms),
    variantGroups,
  );
  const row = penaltyTable[Math.min(matches.length, penaltyTable.length - 1)] ?? {
    penalty: 0,
    severity: "none",
  };

  return toScoredIndicator(row.penalty, maxPenalty, matches, row.severity);
}

function deduplicateTargetedTermVariants(matches: string[], variantGroups: readonly TermVariantGroup[]) {
  const selectedVariants = new Map<string, string>();

  for (const group of variantGroups) {
    const matchedVariants = group.filter((term) => matches.includes(term));

    if (matchedVariants.length < 2) {
      continue;
    }

    const preferred = [...matchedVariants].sort(
      (left, right) => right.length - left.length || group.indexOf(left) - group.indexOf(right),
    )[0];

    if (!preferred) {
      continue;
    }

    for (const variant of matchedVariants) {
      selectedVariants.set(variant, preferred);
    }
  }

  return matches.filter((term) => !selectedVariants.has(term) || selectedVariants.get(term) === term);
}

function scoreClarity(input: NormalizedV2Input, wordCount: number): ScoredIndicator {
  const maxPenalty = V2_SCORING_CONFIG.maximumPenalties.clarity;
  const vagueMatches = getNonOverlappingTermMatches(input.normalizedText, VAGUE_PHRASES);
  const metadataSignals = [input.keywords.length > 0, Boolean(input.categoryName), Boolean(input.publicationYear)].filter(
    Boolean,
  ).length;
  const missingMetadataCount = 3 - metadataSignals;
  const shortAbstractPenalty = wordCount < 120 ? 2 : 0;
  const penalty =
    vagueMatches.length * V2_SCORING_CONFIG.clarity.vaguePhrasePenalty +
    missingMetadataCount * V2_SCORING_CONFIG.clarity.missingMetadataPenalty +
    shortAbstractPenalty;

  return toScoredIndicator(penalty, maxPenalty, vagueMatches);
}

function getAdvancedSignalMatches(normalizedText: string) {
  return Object.entries(ADVANCED_SIGNAL_GROUPS).flatMap(([group, terms]) => {
    const matchedTerms = getNonOverlappingTermMatches(normalizedText, [...terms]);
    return matchedTerms.length > 0 ? [{ group, matchedTerms }] : [];
  });
}

function getComplexityAdjustment(signalCount: number, prerequisiteSeverity: IndicatorSeverity) {
  const adjustments = V2_SCORING_CONFIG.complexityAdjustments;

  if (signalCount >= 3 && prerequisiteSeverity === "high") {
    return adjustments.threeOrMoreWithHighPrerequisite;
  }
  if (signalCount >= 3) return adjustments.threeOrMore;
  if (signalCount === 2) return adjustments.two;
  if (signalCount === 1) return adjustments.one;
  return adjustments.none;
}

function getPenaltyDrivers(
  indicators: V2ScoringResult["indicators"],
  advancedGroupCount: number,
) {
  const labels: Record<keyof V2ScoringResult["indicators"], string> = {
    abstractLength: "abstract length",
    sentenceComplexity: "sentence complexity",
    jargonDensity: "dense technical terminology",
    methodologyComplexity: "methodology complexity",
    statisticalComplexity: "statistical complexity",
    prerequisiteComplexity: "prerequisite complexity",
    clarity: "abstract clarity limitations",
  };
  const drivers = (Object.entries(indicators) as Array<[keyof typeof indicators, ScoredIndicator]>)
    .filter(([, result]) => result.penalty >= 5)
    .sort(([, left], [, right]) => right.penalty - left.penalty)
    .map(([key]) => labels[key]);

  if (advancedGroupCount >= 2) {
    drivers.unshift("multiple advanced-domain signals");
  }

  return [...new Set(drivers)];
}

export function scorePaperDifficultyV2(input: NormalizedV2Input, profile: CategoryProfile): V2ScoringResult {
  const words = tokenizeWords(input.abstract);
  const wordCount = words.length;
  const sentences = splitSentences(input.abstract);
  const methodology = scoreDistinctTerms(
    input.normalizedText,
    V2_COMPLEX_METHODOLOGY_TERMS,
    V2_SCORING_CONFIG.maximumPenalties.methodology,
    V2_SCORING_CONFIG.termPenalties.methodology,
    METHODOLOGY_VARIANT_GROUPS,
  );
  const statistical = scoreDistinctTerms(
    input.normalizedText,
    V2_STATISTICAL_TERMS,
    V2_SCORING_CONFIG.maximumPenalties.statistical,
    V2_SCORING_CONFIG.termPenalties.statistical,
    STATISTICAL_VARIANT_GROUPS,
  );
  const prerequisite = scoreDistinctTerms(
    input.normalizedText,
    V2_PREREQUISITE_TERMS,
    V2_SCORING_CONFIG.maximumPenalties.prerequisite,
    V2_SCORING_CONFIG.termPenalties.prerequisite,
    PREREQUISITE_VARIANT_GROUPS,
  );
  const jargon = scoreJargon(input.normalizedText, input.combinedText, wordCount, profile);
  const indicators = {
    abstractLength: scoreAbstractLength(wordCount),
    sentenceComplexity: scoreSentenceComplexity(sentences, wordCount),
    jargonDensity: jargon.indicator,
    methodologyComplexity: methodology,
    statisticalComplexity: statistical,
    prerequisiteComplexity: prerequisite,
    clarity: scoreClarity(input, wordCount),
  };
  const advancedMatches = getAdvancedSignalMatches(input.normalizedText);
  const advancedMatchedTerms = new Set(advancedMatches.flatMap((match) => match.matchedTerms));
  const categoryStrongTerms = deduplicateTargetedTermVariants(
    getNonOverlappingTermMatches(input.normalizedText, profile.strongTerms).filter(
      (term) => !advancedMatchedTerms.has(term),
    ),
    PREREQUISITE_VARIANT_GROUPS,
  );
  const strongSignalCount = advancedMatches.length + categoryStrongTerms.length;
  const complexityAdjustment = getComplexityAdjustment(strongSignalCount, prerequisite.severity);
  const basePenalty = Object.values(indicators).reduce((sum, indicator) => sum + indicator.penalty, 0);
  const preliminaryScore = clamp(100 - basePenalty - complexityAdjustment, 0, 100);
  const beginnerEligible =
    [methodology.severity, statistical.severity, prerequisite.severity].every(
      (severity) => severity === "none" || severity === "low",
    ) &&
    advancedMatches.length === 0 &&
    categoryStrongTerms.length === 0;
  const beginnerEligibilityAdjustment =
    preliminaryScore >= V2_DIFFICULTY_THRESHOLDS.beginnerFriendly && !beginnerEligible
      ? preliminaryScore - (V2_DIFFICULTY_THRESHOLDS.beginnerFriendly - 1)
      : 0;
  const beginnerScore = clamp(preliminaryScore - beginnerEligibilityAdjustment, 0, 100);
  const finalTotalPenalty = basePenalty + complexityAdjustment + beginnerEligibilityAdjustment;
  const scores: PaperDifficultyScores = {
    abstractLengthScore: indicators.abstractLength.score,
    sentenceComplexityScore: indicators.sentenceComplexity.score,
    jargonDensityScore: indicators.jargonDensity.score,
    methodologyComplexityScore: indicators.methodologyComplexity.score,
    statisticalComplexityScore: indicators.statisticalComplexity.score,
    prerequisiteScore: indicators.prerequisiteComplexity.score,
    clarityScore: indicators.clarity.score,
  };

  return {
    indicators,
    scores,
    beginnerScore,
    preliminaryBeginnerScore: preliminaryScore,
    baseTotalPenalty: basePenalty,
    finalTotalPenalty,
    beginnerEligible,
    matchedTechnicalTerms: jargon.technicalTerms,
    matchedJargonTerms: jargon.jargonTerms,
    matchedAcronyms: jargon.acronyms,
    matchedCategoryNeutralTerms: jargon.categoryNeutralTerms,
    advancedSignalGroups: advancedMatches.map((match) => match.group),
    categoryStrongTerms,
    complexityAdjustment,
    beginnerEligibilityAdjustment,
    drivers: getPenaltyDrivers(indicators, advancedMatches.length),
    abstractWordCount: wordCount,
  };
}

export function getDifficultyLevelV2(beginnerScore: number): DifficultyLevel {
  if (beginnerScore >= V2_DIFFICULTY_THRESHOLDS.beginnerFriendly) return "beginner_friendly";
  if (beginnerScore >= V2_DIFFICULTY_THRESHOLDS.moderate) return "moderate";
  if (beginnerScore >= V2_DIFFICULTY_THRESHOLDS.difficult) return "difficult";
  return "expert";
}

export function estimateReadingTimeV2(wordCount: number, difficultyLevel: DifficultyLevel) {
  const multiplierByLevel: Record<DifficultyLevel, number> = {
    beginner_friendly: 1,
    moderate: 1.15,
    difficult: 1.35,
    expert: 1.6,
  };
  const estimatedFullPaperWords = Math.max(2200, wordCount * 22);

  return clamp(Math.ceil((estimatedFullPaperWords / 220) * multiplierByLevel[difficultyLevel]), 10, 90);
}
