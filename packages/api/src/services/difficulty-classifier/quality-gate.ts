import { METADATA_ONLY_SIGNALS, METHOD_SIGNALS, RESULT_SIGNALS, VAGUE_PHRASES } from "./terms";
import { getDistinctTermMatches, normalizeText, tokenizeWords } from "./text-utils";
import type { ClassifyPaperDifficultyInput, QualityGateResult } from "./types";

const GENERIC_TITLE_PATTERNS = [
  /^(?:the role of|the importance of|an overview of|introduction to)\b/,
  /\b(?:in today's world|and the future)\s*$/,
];

function hasGenericTitle(title: string) {
  const normalizedTitle = normalizeText(title);
  return GENERIC_TITLE_PATTERNS.some((pattern) => pattern.test(normalizedTitle));
}

export function runQualityGate(input: ClassifyPaperDifficultyInput): QualityGateResult {
  const title = input.title.trim();
  const abstract = input.abstract.trim();
  const normalizedAbstract = normalizeText(abstract);
  const wordCount = tokenizeWords(abstract).length;
  const methodSignalCount = getDistinctTermMatches(normalizedAbstract, METHOD_SIGNALS).length;
  const resultSignalCount = getDistinctTermMatches(normalizedAbstract, RESULT_SIGNALS).length;
  const vagueSignalCount = getDistinctTermMatches(normalizedAbstract, VAGUE_PHRASES).length;
  const metadataOnlySignalCount = getDistinctTermMatches(normalizedAbstract, METADATA_ONLY_SIGNALS).length;
  const genericTitle = hasGenericTitle(title);
  const reasons: string[] = [];

  if (!title) {
    reasons.push("Title is missing.");
  }

  if (!abstract) {
    reasons.push("Abstract is missing.");
  } else {
    if (wordCount < 60) {
      reasons.push("Abstract is too short for reliable classification (fewer than 60 words).");
    }

    if (wordCount < 100 && metadataOnlySignalCount > 0) {
      reasons.push("Short abstract contains metadata-only or non-research signals.");
    }

    if (wordCount >= 60 && wordCount < 100 && metadataOnlySignalCount === 0) {
      const shortAbstractConditions = [
        methodSignalCount === 0,
        resultSignalCount === 0,
        vagueSignalCount >= 2,
        genericTitle,
      ];
      const hasGenericContext = vagueSignalCount >= 2 || genericTitle;

      if (hasGenericContext && shortAbstractConditions.filter(Boolean).length >= 2) {
        reasons.push("Short abstract has multiple generic or incomplete research signals.");
      }
    }
  }

  return {
    shouldReview: reasons.length > 0,
    reasons,
    signals: {
      wordCount,
      methodSignalCount,
      resultSignalCount,
      vagueSignalCount,
      metadataOnlySignalCount,
    },
  };
}
