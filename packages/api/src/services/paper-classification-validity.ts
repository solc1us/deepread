export const MANUAL_CLASSIFICATION_VERSION = "manual-admin-v1";

export type ClassificationValidityInput = {
  difficultyLevel: string;
  beginnerScore: number | null;
  classificationVersion: string;
  classificationReason: string;
};

export function hasValidClassification(classification: ClassificationValidityInput | null) {
  if (classification?.classificationVersion === MANUAL_CLASSIFICATION_VERSION) {
    return Boolean(classification.difficultyLevel && classification.classificationReason.trim());
  }

  const beginnerScore = classification?.beginnerScore;

  return Boolean(
    classification &&
      classification.difficultyLevel &&
      typeof beginnerScore === "number" &&
      Number.isInteger(beginnerScore) &&
      beginnerScore >= 0 &&
      beginnerScore <= 100 &&
      classification.classificationVersion.trim(),
  );
}
