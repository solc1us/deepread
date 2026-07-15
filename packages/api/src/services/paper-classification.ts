import prisma from "@deepread/db";
import { env } from "@deepread/env/server";

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
import { BackendProfiler, formatProfileSummary } from "./backend-profiler";

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

function runProfiledSync<TResult>(
  profiler: BackendProfiler | undefined,
  name: string,
  operation: () => TResult,
) {
  return profiler ? profiler.measureSync(name, operation) : operation();
}

function runProfiled<TResult>(
  profiler: BackendProfiler | undefined,
  name: string,
  operation: () => Promise<TResult>,
) {
  return profiler ? profiler.measure(name, operation) : operation();
}

async function classifyPaperByIdWithProfiler(
  paperId: string,
  profiler?: BackendProfiler,
): Promise<ClassifyPaperByIdResult> {
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
    await runProfiled(profiler, "database_write_per_paper", () =>
      prisma.paper.update({
        where: {
          id: paper.id,
          status: {
            not: "inactive",
          },
        },
        data: {
          status: "rejected",
        },
      }),
    );

    return {
      paperId: paper.id,
      status: "rejected",
      rejectionReason: validationError,
    };
  }

  let classifierResult: ReturnType<typeof classifyPaperDifficultyV2>;

  try {
    classifierResult = runProfiledSync(profiler, "classifier_per_paper", () =>
      classifyPaperDifficultyV2({
        title: paper.title,
        abstract: paper.abstract,
        keywords: toStringArray(paper.keywords),
        categoryName: paper.category.name,
        publicationYear: paper.publicationYear,
      }),
    );
  } catch (error) {
    const rejectionReason = `Classification could not be performed: ${getErrorMessage(error)}`;

    await runProfiled(profiler, "database_write_per_paper", () =>
      prisma.paper.update({
        where: {
          id: paper.id,
          status: {
            not: "inactive",
          },
        },
        data: {
          status: "rejected",
        },
      }),
    );

    return {
      paperId: paper.id,
      status: "rejected",
      rejectionReason,
    };
  }

  if (classifierResult.outcome === "needs_review") {
    await runProfiled(profiler, "database_write_per_paper", () =>
      prisma.paper.update({
        where: {
          id: paper.id,
          status: {
            not: "inactive",
          },
        },
        data: {
          status: "needs_review",
        },
      }),
    );

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

  await runProfiled(profiler, "database_write_per_paper", () =>
    prisma.$transaction([
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
    ]),
  );

  return {
    paperId: paper.id,
    status: "published",
    classification: classifierResult.classification,
    classificationVersion: classifierResult.classificationVersion,
  };
}

export async function classifyPaperById(paperId: string): Promise<ClassifyPaperByIdResult> {
  return await classifyPaperByIdWithProfiler(paperId);
}

export async function classifyPendingPapers(input: ClassifyPendingPapersInput = {}): Promise<ClassifyPendingPapersResult> {
  const profiler = env.CLASSIFICATION_PROFILING ? new BackendProfiler() : undefined;
  let totalFound = 0;
  let totalClassified = 0;
  let totalPublished = 0;
  let totalNeedsReview = 0;
  let totalRejected = 0;
  let totalFailed = 0;
  const reviews: ClassifyPendingPapersResult["reviews"] = [];
  const errors: string[] = [];
  let profileStatus: "success" | "partial" | "failed" = "failed";

  try {
    const limit = normalizeLimit(input.limit);
    const fetchPendingPapers = () =>
      prisma.paper.findMany({
        where: {
          status: "pending" as const,
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        },
        orderBy: {
          createdAt: "asc" as const,
        },
        take: limit,
        select: {
          id: true,
        },
      });
    const pendingPapers = await runProfiled(profiler, "database_fetch", fetchPendingPapers);
    const paperIds = [...new Set(pendingPapers.map((paper) => paper.id))];
    totalFound = paperIds.length;

    const outcomes = await mapWithConcurrency(
      paperIds,
      CLASSIFICATION_BATCH_CONCURRENCY,
      async (paperId) => {
        try {
          return {
            outcome: "success",
            paperId,
            result: await classifyPaperByIdWithProfiler(paperId, profiler),
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

    profileStatus = totalFailed > 0 ? "partial" : "success";

    return {
      totalFound,
      totalClassified,
      totalPublished,
      totalNeedsReview,
      totalRejected,
      totalFailed,
      reviews,
      errors,
    };
  } finally {
    if (profiler) {
      console.info(
        formatProfileSummary({
          title: "Classification Profile",
          metadata: {
            status: profileStatus,
            papers_found: totalFound,
            successful: totalFound - totalFailed,
            failed: totalFailed,
            needs_review: totalNeedsReview,
            published: totalPublished,
            concurrency: CLASSIFICATION_BATCH_CONCURRENCY,
          },
          snapshot: profiler.finish(),
          metrics: [
            { name: "database_fetch", label: "database_fetch_ms", kind: "duration" },
            { name: "classifier_per_paper", label: "classifier_latency_ms", kind: "latency" },
            { name: "database_write_per_paper", label: "database_write_latency_ms", kind: "latency" },
          ],
        }),
      );
    }
  }
}
