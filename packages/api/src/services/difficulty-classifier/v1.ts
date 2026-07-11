import {
  ACADEMIC_JARGON_TERMS,
  ADVANCED_TECHNICAL_TERMS,
  CLARITY_SIGNALS,
  COMPLEX_METHODOLOGY_TERMS,
  DOMAIN_SPECIFIC_CATEGORIES,
  PREREQUISITE_TERMS,
  STATISTICAL_TERMS,
  VAGUE_SIGNALS,
} from "./terms";
import { buildClassificationReason, buildReadingWarning, buildRecommendedReader } from "./messages";
import { clamp, countAcronyms, countTermMatches, normalizeText, splitSentences, tokenizeWords } from "./text-utils";
import type {
  ClassifyPaperDifficultyInput,
  DifficultyLevel,
  IndicatorResult,
  PaperDifficultyClassification,
  PaperDifficultyScores,
} from "./types";

function toIndicatorScore(penalty: number, maxPenalty: number): number {
  return clamp(Math.round(100 - (penalty / maxPenalty) * 100));
}

function scoreAbstractLength(wordCount: number): IndicatorResult {
  let penalty = 0;

  if (wordCount < 60) {
    penalty = 8;
  } else if (wordCount > 300) {
    penalty = 15;
  } else if (wordCount > 240) {
    penalty = 10;
  } else if (wordCount > 190) {
    penalty = 5;
  }

  return {
    penalty,
    score: toIndicatorScore(penalty, 15),
  };
}

function scoreSentenceComplexity(sentences: string[], wordCount: number): IndicatorResult {
  const averageSentenceLength = sentences.length > 0 ? wordCount / sentences.length : wordCount;
  let penalty = 0;

  if (averageSentenceLength > 34) {
    penalty = 15;
  } else if (averageSentenceLength > 28) {
    penalty = 11;
  } else if (averageSentenceLength > 22) {
    penalty = 7;
  } else if (averageSentenceLength > 18) {
    penalty = 3;
  }

  return {
    penalty,
    score: toIndicatorScore(penalty, 15),
  };
}

function scoreJargon(text: string, originalText: string, wordCount: number): IndicatorResult {
  const jargonMatches =
    countTermMatches(text, ACADEMIC_JARGON_TERMS) + countTermMatches(text, ADVANCED_TECHNICAL_TERMS);
  const acronymMatches = countAcronyms(originalText);
  const density = wordCount > 0 ? ((jargonMatches + acronymMatches) / wordCount) * 100 : 0;
  const penalty = clamp(Math.round(density * 6), 0, 20);

  return {
    penalty,
    score: toIndicatorScore(penalty, 20),
  };
}

function scoreTermGroup(text: string, terms: string[], maxPenalty: number, weight: number): IndicatorResult {
  const matches = countTermMatches(text, terms);
  const penalty = clamp(matches * weight, 0, maxPenalty);

  return {
    penalty,
    score: toIndicatorScore(penalty, maxPenalty),
  };
}

function scorePrerequisites(text: string, categoryName?: string): IndicatorResult {
  const prerequisiteMatches = countTermMatches(text, PREREQUISITE_TERMS);
  const advancedMatches = countTermMatches(text, ADVANCED_TECHNICAL_TERMS);
  const domainPenalty =
    categoryName && DOMAIN_SPECIFIC_CATEGORIES.includes(normalizeText(categoryName)) && advancedMatches > 0 ? 3 : 0;
  const penalty = clamp(prerequisiteMatches * 3 + Math.floor(advancedMatches / 2) * 2 + domainPenalty, 0, 15);

  return {
    penalty,
    score: toIndicatorScore(penalty, 15),
  };
}

function scoreClarity(text: string, wordCount: number, input: ClassifyPaperDifficultyInput): IndicatorResult {
  const clarityMatches = countTermMatches(text, CLARITY_SIGNALS);
  const vagueMatches = countTermMatches(text, VAGUE_SIGNALS);
  const missingMetadataPenalty = [
    input.keywords && input.keywords.length > 0,
    Boolean(input.categoryName),
    Boolean(input.publicationYear),
  ].filter(Boolean).length;
  const metadataPenalty = (3 - missingMetadataPenalty) * 2;
  const shortTextPenalty = wordCount < 80 ? 3 : 0;
  const clarityBonus = Math.min(clarityMatches * 2, 5);
  const penalty = clamp(vagueMatches * 2 + metadataPenalty + shortTextPenalty - clarityBonus, 0, 15);

  return {
    penalty,
    score: toIndicatorScore(penalty, 15),
  };
}

function getDifficultyLevel(score: number): DifficultyLevel {
  if (score >= 80) {
    return "beginner_friendly";
  }

  if (score >= 60) {
    return "moderate";
  }

  if (score >= 40) {
    return "difficult";
  }

  return "expert";
}

function estimateReadingTime(wordCount: number, difficultyLevel: DifficultyLevel) {
  const multiplierByLevel: Record<DifficultyLevel, number> = {
    beginner_friendly: 1,
    moderate: 1.15,
    difficult: 1.35,
    expert: 1.6,
  };
  const estimatedFullPaperWords = Math.max(2200, wordCount * 22);

  return clamp(Math.ceil((estimatedFullPaperWords / 220) * multiplierByLevel[difficultyLevel]), 10, 90);
}

function getPenaltyDrivers(indicators: Record<string, IndicatorResult>) {
  return Object.entries(indicators)
    .filter(([, result]) => result.penalty >= 9)
    .sort(([, left], [, right]) => right.penalty - left.penalty)
    .map(([name]) => name);
}

export function classifyPaperDifficulty(input: ClassifyPaperDifficultyInput): PaperDifficultyClassification {
  const title = input.title.trim();
  const abstract = input.abstract.trim();
  const keywordText = input.keywords?.join(" ") ?? "";
  const categoryText = input.categoryName ?? "";
  const combinedText = [title, abstract, keywordText, categoryText].filter(Boolean).join(" ");
  const normalizedText = normalizeText(combinedText);
  const words = tokenizeWords(abstract);
  const wordCount = words.length;
  const sentences = splitSentences(abstract);

  const indicators = {
    "long or thin abstract": scoreAbstractLength(wordCount),
    "long sentence structure": scoreSentenceComplexity(sentences, wordCount),
    "technical jargon and acronyms": scoreJargon(normalizedText, combinedText, wordCount),
    "complex methodology": scoreTermGroup(normalizedText, COMPLEX_METHODOLOGY_TERMS, 15, 3),
    "statistical complexity": scoreTermGroup(normalizedText, STATISTICAL_TERMS, 15, 2),
    "advanced prerequisite signals": scorePrerequisites(normalizedText, input.categoryName),
    "metadata or abstract clarity gaps": scoreClarity(normalizedText, wordCount, input),
  };

  const scores: PaperDifficultyScores = {
    abstractLengthScore: indicators["long or thin abstract"].score,
    sentenceComplexityScore: indicators["long sentence structure"].score,
    jargonDensityScore: indicators["technical jargon and acronyms"].score,
    methodologyComplexityScore: indicators["complex methodology"].score,
    statisticalComplexityScore: indicators["statistical complexity"].score,
    prerequisiteScore: indicators["advanced prerequisite signals"].score,
    clarityScore: indicators["metadata or abstract clarity gaps"].score,
  };
  const totalPenalty = Object.values(indicators).reduce((sum, result) => sum + result.penalty, 0);
  const beginnerScore = clamp(Math.round(100 - totalPenalty));
  const difficultyLevel = getDifficultyLevel(beginnerScore);
  const drivers = getPenaltyDrivers(indicators);

  return {
    difficultyLevel,
    beginnerScore,
    estimatedReadingTime: estimateReadingTime(wordCount + tokenizeWords(title).length, difficultyLevel),
    scores,
    classificationReason: buildClassificationReason(difficultyLevel, beginnerScore, drivers),
    readingWarning: buildReadingWarning(difficultyLevel, drivers),
    recommendedReader: buildRecommendedReader(difficultyLevel),
  };
}
