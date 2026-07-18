export const INTERNAL_CLASSIFICATION_ERROR_MESSAGE =
  "Classification failed due to an internal processing error.";

export class PaperClassificationServiceError extends Error {
  constructor(
    public readonly code: "PAPER_NOT_FOUND" | "PAPER_INACTIVE" | "PAPER_STATUS_NOT_ALLOWED",
    message: string,
  ) {
    super(message);
    this.name = "PaperClassificationServiceError";
  }
}

export function getClassificationClientErrorMessage(error: unknown) {
  if (error instanceof PaperClassificationServiceError) {
    switch (error.code) {
      case "PAPER_NOT_FOUND":
        return "Paper is no longer available for classification.";
      case "PAPER_INACTIVE":
      case "PAPER_STATUS_NOT_ALLOWED":
        return "Paper is no longer eligible for classification.";
    }
  }

  return INTERNAL_CLASSIFICATION_ERROR_MESSAGE;
}

export function getClassificationErrorType(error: unknown) {
  if (error instanceof PaperClassificationServiceError) {
    return error.code;
  }

  if (error instanceof Error) {
    return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(error.name) ? error.name : "Error";
  }

  return typeof error;
}
