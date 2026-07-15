import prisma from "@deepread/db";

import {
  CLASSIFICATION_BATCH_DEFAULT_LIMIT,
  CLASSIFICATION_BATCH_LIMIT_ERROR,
  CLASSIFICATION_BATCH_MAX_LIMIT,
  CLASSIFICATION_BATCH_MIN_LIMIT,
} from "../classification-batch-limits";
import {
  classifyPaperDifficultyV2,
  type PaperDifficultyClassification,
} from "./paper-difficulty-classifier";

const CLASSIFICATION_BATCH_CONCURRENCY = 8;
export const CLASSIFICATION_VERSION = "rule-based-v2.1.4";

export class PaperClassificationServiceError extends Error {
  constructor(
    public readonly code: "PAPER_NOT_FOUND" | "PAPER_INACTIVE",
    message: string,
  ) {
    super(message);
    this.name = "PaperClassificationServiceError";
  }
}

export interface ClassifyPendingPapersInput {
  limit?: number;
  categoryId?: string;
}

export interface ClassifyPaperByIdResult {
  paperId: string;
  status: "published" | "needs_review" | "rejected";
  classification?: PaperDifficultyClassification;
  classificationVersion?: typeof CLASSIFICATION_VERSION;
  reviewReasons?: string[];
  rejectionReason?: string;
}

export interface ClassifyPendingPapersResult {
  totalFound: number;
  totalClassified: number;
  totalPublished: number;
  totalNeedsReview: number;
  totalRejected: number;
  totalFailed: number;
  reviews: Array<{
    paperId: string;
    reasons: string[];
  }>;
  errors: string[];
}

function normalizeLimit(limit?: number) {
  const rawLimit = limit ?? CLASSIFICATION_BATCH_DEFAULT_LIMIT;

  if (
    !Number.isInteger(rawLimit) ||
    rawLimit < CLASSIFICATION_BATCH_MIN_LIMIT ||
    rawLimit > CLASSIFICATION_BATCH_MAX_LIMIT
  ) {
    throw new Error(CLASSIFICATION_BATCH_LIMIT_ERROR);
  }

  return rawLimit;
}

async function mapWithConcurrency<T, TResult>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<TResult>,
) {
  const results = new Array<TResult>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const item = items[currentIndex];

      if (item !== undefined) {
        results[currentIndex] = await worker(item);
      }
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

  return results;
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function buildClassificationData(
  classification: PaperDifficultyClassification,
  classificationVersion: typeof CLASSIFICATION_VERSION,
) {
  return {
    difficultyLevel: classification.difficultyLevel,
    beginnerScore: classification.beginnerScore,
    estimatedReadingTime: classification.estimatedReadingTime,
    abstractLengthScore: classification.scores.abstractLengthScore,
    sentenceComplexityScore: classification.scores.sentenceComplexityScore,
    jargonDensityScore: classification.scores.jargonDensityScore,
    methodologyComplexityScore: classification.scores.methodologyComplexityScore,
    statisticalComplexityScore: classification.scores.statisticalComplexityScore,
    prerequisiteScore: classification.scores.prerequisiteScore,
    clarityScore: classification.scores.clarityScore,
    classificationReason: classification.classificationReason,
    readingWarning: classification.readingWarning,
    recommendedReader: classification.recommendedReader,
    classificationVersion,
  };
}

function getValidationError(paper: {
  title: string | null;
  abstract: string | null;
  category: { id: string; name: string } | null;
}) {
  if (!paper.title?.trim()) {
    return "Missing title";
  }

  if (!paper.abstract?.trim()) {
    return "Missing abstract";
  }

  if (!paper.category) {
    return "Missing category";
  }

  return null;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function classifyPaperById(paperId: string): Promise<ClassifyPaperByIdResult> {
  const paper = await prisma.paper.findUnique({
    where: {
      id: paperId,
    },
    select: {
      id: true,
      title: true,
      abstract: true,
      keywords: true,
      publicationYear: true,
      status: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!paper) {
    throw new PaperClassificationServiceError("PAPER_NOT_FOUND", "Paper not found");
  }

  if (paper.status === "inactive") {
    throw new PaperClassificationServiceError("PAPER_INACTIVE", "Inactive papers cannot be classified");
  }

  const validationError = getValidationError(paper);

  if (validationError) {
    await prisma.paper.update({
      where: {
        id: paper.id,
        status: {
          not: "inactive",
        },
      },
      data: {
        status: "rejected",
      },
    });

    return {
      paperId: paper.id,
      status: "rejected",
      rejectionReason: validationError,
    };
  }

  let classifierResult: ReturnType<typeof classifyPaperDifficultyV2>;

  try {
    classifierResult = classifyPaperDifficultyV2({
      title: paper.title,
      abstract: paper.abstract,
      keywords: toStringArray(paper.keywords),
      categoryName: paper.category.name,
      publicationYear: paper.publicationYear,
    });
  } catch (error) {
    const rejectionReason = `Classification could not be performed: ${getErrorMessage(error)}`;

    await prisma.paper.update({
      where: {
        id: paper.id,
        status: {
          not: "inactive",
        },
      },
      data: {
        status: "rejected",
      },
    });

    return {
      paperId: paper.id,
      status: "rejected",
      rejectionReason,
    };
  }

  if (classifierResult.outcome === "needs_review") {
    await prisma.paper.update({
      where: {
        id: paper.id,
        status: {
          not: "inactive",
        },
      },
      data: {
        status: "needs_review",
      },
    });

    return {
      paperId: paper.id,
      status: "needs_review",
      classificationVersion: classifierResult.classificationVersion,
      reviewReasons: classifierResult.reviewReasons,
    };
  }

  const classificationData = buildClassificationData(
    classifierResult.classification,
    classifierResult.classificationVersion,
  );

  await prisma.$transaction([
    prisma.paperClassification.upsert({
      where: {
        paperId: paper.id,
      },
      update: classificationData,
      create: {
        paperId: paper.id,
        ...classificationData,
      },
    }),
    prisma.paper.update({
      where: {
        id: paper.id,
        status: {
          not: "inactive",
        },
      },
      data: {
        status: "published",
      },
    }),
  ]);

  return {
    paperId: paper.id,
    status: "published",
    classification: classifierResult.classification,
    classificationVersion: classifierResult.classificationVersion,
  };
}

export async function classifyPendingPapers(input: ClassifyPendingPapersInput = {}): Promise<ClassifyPendingPapersResult> {
  const limit = normalizeLimit(input.limit);
  const pendingPapers = await prisma.paper.findMany({
    where: {
      status: "pending",
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
    select: {
      id: true,
    },
  });
  const paperIds = [...new Set(pendingPapers.map((paper) => paper.id))];
  let totalClassified = 0;
  let totalPublished = 0;
  let totalNeedsReview = 0;
  let totalRejected = 0;
  let totalFailed = 0;
  const reviews: ClassifyPendingPapersResult["reviews"] = [];
  const errors: string[] = [];

  const outcomes = await mapWithConcurrency(
    paperIds,
    CLASSIFICATION_BATCH_CONCURRENCY,
    async (paperId) => {
      try {
        return {
          outcome: "success",
          paperId,
          result: await classifyPaperById(paperId),
        } as const;
      } catch (error) {
        return {
          outcome: "failure",
          paperId,
          error,
        } as const;
      }
    },
  );

  for (const outcome of outcomes) {
    if (outcome.outcome === "success") {
      const { paperId, result } = outcome;

      if (result.status === "published") {
        totalClassified += 1;
        totalPublished += 1;
      } else if (result.status === "needs_review") {
        totalNeedsReview += 1;
        reviews.push({
          paperId,
          reasons: result.reviewReasons ?? [],
        });
      } else {
        totalRejected += 1;
        errors.push(`Rejected paper ${paperId}: ${result.rejectionReason ?? "classification could not be performed"}`);
      }
    } else {
      totalFailed += 1;
      errors.push(`Failed to classify paper ${outcome.paperId}: ${getErrorMessage(outcome.error)}`);
    }
  }

  return {
    totalFound: paperIds.length,
    totalClassified,
    totalPublished,
    totalNeedsReview,
    totalRejected,
    totalFailed,
    reviews,
    errors,
  };
}
