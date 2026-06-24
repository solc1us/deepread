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

interface IndicatorResult {
  penalty: number;
  score: number;
}

const COMPLEX_METHODOLOGY_TERMS = [
  "bayesian inference",
  "causal inference",
  "computational model",
  "deep learning",
  "difference-in-differences",
  "discourse analysis",
  "econometric",
  "experimental design",
  "finite element",
  "gradient-based",
  "instrumental variable",
  "latent variable",
  "longitudinal",
  "machine learning",
  "meta-analysis",
  "mixed methods",
  "monte carlo",
  "multilevel model",
  "neural network",
  "phenomenology",
  "quasi-experimental",
  "randomized controlled trial",
  "regression discontinuity",
  "simulation",
  "structural equation",
  "systematic review",
];

const STATISTICAL_TERMS = [
  "anova",
  "bayesian",
  "benchmark",
  "confidence interval",
  "correlation",
  "dataset",
  "effect size",
  "f-statistic",
  "hypothesis test",
  "logistic regression",
  "multivariate",
  "p-value",
  "regression",
  "sample size",
  "significance",
  "standard deviation",
  "statistical",
  "t-test",
  "variance",
];

const ADVANCED_TECHNICAL_TERMS = [
  "algorithm",
  "attention mechanism",
  "backpropagation",
  "biomarker",
  "computational",
  "convolutional",
  "cryptographic",
  "differential equation",
  "eigenvalue",
  "embedding",
  "finite element",
  "genomic",
  "gradient",
  "hyperparameter",
  "neural",
  "optimization",
  "polymerase",
  "probabilistic",
  "reinforcement learning",
  "stochastic",
  "transformer",
  "vector",
];

const PREREQUISITE_TERMS = [
  "advanced",
  "benchmark datasets",
  "domain-specific",
  "graduate",
  "mathematical",
  "mechanistic",
  "model evaluation",
  "prior knowledge",
  "specialized",
  "theoretical framework",
  "underlying mechanism",
];

const ACADEMIC_JARGON_TERMS = [
  "construct",
  "epistemological",
  "framework",
  "heterogeneity",
  "implementation fidelity",
  "implications",
  "intervention",
  "methodological",
  "operationalization",
  "paradigm",
  "phenomenon",
  "robustness",
  "taxonomy",
  "validity",
];

const CLARITY_SIGNALS = [
  "this paper",
  "this study",
  "we examine",
  "we investigate",
  "we report",
  "we show",
  "results suggest",
  "findings suggest",
  "the study compares",
];

const VAGUE_SIGNALS = ["complex", "novel", "robust", "significant", "various", "multiple", "comprehensive"];

const DOMAIN_SPECIFIC_CATEGORIES = ["computer science", "engineering", "health", "medicine", "psychology"];

function clamp(value: number, min = 0, max = 100) {
  return Math.min(Math.max(value, min), max);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokenizeWords(value: string) {
  return value.match(/[a-z0-9]+(?:-[a-z0-9]+)?/gi) ?? [];
}

function splitSentences(value: string) {
  return value
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function countTermMatches(text: string, terms: string[]) {
  return terms.reduce((count, term) => {
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const matches = text.match(new RegExp(`\\b${escapedTerm}\\b`, "gi"));
    return count + (matches?.length ?? 0);
  }, 0);
}

function countAcronyms(text: string) {
  const matches = text.match(/\b[A-Z]{2,}(?:-[A-Z0-9]+)?\b/g) ?? [];
  return matches.filter((item) => !["PDF", "DOI", "URL"].includes(item)).length;
}

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

function buildClassificationReason(difficultyLevel: DifficultyLevel, score: number, drivers: string[]) {
  const readableLevel = difficultyLevel.replace("_", " ");
  const mainDrivers = drivers.length > 0 ? drivers.slice(0, 3).join(", ") : "mostly clear metadata signals";

  return `Classified as ${readableLevel} with a beginner score of ${score} because of ${mainDrivers}.`;
}

function buildReadingWarning(difficultyLevel: DifficultyLevel, drivers: string[]) {
  if (difficultyLevel === "beginner_friendly") {
    return "Beginners should be able to start with the abstract, but may still need to look up unfamiliar terms.";
  }

  if (drivers.length === 0) {
    return "Beginners may need extra context before reading the full paper.";
  }

  return `Beginners may struggle with ${drivers.slice(0, 2).join(" and ")}.`;
}

function buildRecommendedReader(difficultyLevel: DifficultyLevel) {
  if (difficultyLevel === "beginner_friendly") {
    return "Suitable for students who are starting to read academic papers.";
  }

  if (difficultyLevel === "moderate") {
    return "Best for beginners with some topic familiarity or support from a course context.";
  }

  if (difficultyLevel === "difficult") {
    return "Best for readers with prior coursework or background knowledge in the topic.";
  }

  return "Best for advanced students or readers already familiar with the methods and domain.";
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
