import type { DifficultyLevel } from "./types";

export function buildClassificationReason(difficultyLevel: DifficultyLevel, score: number, drivers: string[]) {
  const readableLevel = difficultyLevel.replace("_", " ");
  const mainDrivers = drivers.length > 0 ? drivers.slice(0, 3).join(", ") : "mostly clear metadata signals";

  return `Classified as ${readableLevel} with a beginner score of ${score} because of ${mainDrivers}.`;
}

export function buildReadingWarning(difficultyLevel: DifficultyLevel, drivers: string[]) {
  if (difficultyLevel === "beginner_friendly") {
    return "Beginners should be able to start with the abstract, but may still need to look up unfamiliar terms.";
  }

  if (drivers.length === 0) {
    return "Beginners may need extra context before reading the full paper.";
  }

  return `Beginners may struggle with ${drivers.slice(0, 2).join(" and ")}.`;
}

export function buildRecommendedReader(difficultyLevel: DifficultyLevel) {
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

export function formatReviewReasons(reasons: string[]) {
  return [...new Set(reasons.map((reason) => reason.trim()).filter(Boolean))].map((reason) =>
    /[.!?]$/.test(reason) ? reason : `${reason}.`,
  );
}

export function buildClassificationReasonV2(difficultyLevel: DifficultyLevel, score: number, drivers: string[]) {
  const readableLevel = difficultyLevel.replace("_", " ");
  const mainDrivers = drivers.length > 0 ? drivers.slice(0, 3).join(", ") : "clear research and metadata signals";

  return `Classified as ${readableLevel} with a beginner score of ${score} because of ${mainDrivers}.`;
}

export function buildReadingWarningV2(difficultyLevel: DifficultyLevel, drivers: string[]) {
  if (difficultyLevel === "beginner_friendly") {
    return "Beginners should be able to start with the abstract, but may still need to look up unfamiliar terms.";
  }

  if (drivers.length === 0) {
    return "Beginners may need additional topic context before reading the full paper.";
  }

  return `Beginners may need support with ${drivers.slice(0, 2).join(" and ")}.`;
}
