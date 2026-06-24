import prisma from "@deepread/db";

import {
  classifyPaperDifficulty,
  type PaperDifficultyClassification,
} from "./paper-difficulty-classifier";

const DEFAULT_CLASSIFICATION_LIMIT = 10;
const MAX_CLASSIFICATION_LIMIT = 50;
export const CLASSIFICATION_VERSION = "rule-based-v1";

export interface ClassifyPendingPapersInput {
  limit?: number;
  categoryId?: string;
}

export interface ClassifyPaperByIdResult {
  paperId: string;
  status: "published" | "rejected";
  classification?: PaperDifficultyClassification;
  rejectionReason?: string;
}

export interface ClassifyPendingPapersResult {
  totalFound: number;
  totalClassified: number;
  totalPublished: number;
  totalRejected: number;
  totalFailed: number;
  errors: string[];
}

function normalizeLimit(limit?: number) {
  const rawLimit = limit ?? DEFAULT_CLASSIFICATION_LIMIT;

  if (!Number.isFinite(rawLimit)) {
    return DEFAULT_CLASSIFICATION_LIMIT;
  }

  return Math.min(Math.max(Math.trunc(rawLimit), 1), MAX_CLASSIFICATION_LIMIT);
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function buildClassificationData(classification: PaperDifficultyClassification) {
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
    classificationVersion: CLASSIFICATION_VERSION,
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
      category: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!paper) {
    throw new Error(`Paper not found: ${paperId}`);
  }

  const validationError = getValidationError(paper);

  if (validationError) {
    await prisma.paper.update({
      where: {
        id: paper.id,
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

  let classification: PaperDifficultyClassification;

  try {
    classification = classifyPaperDifficulty({
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

  const classificationData = buildClassificationData(classification);

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
      },
      data: {
        status: "published",
      },
    }),
  ]);

  return {
    paperId: paper.id,
    status: "published",
    classification,
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
  let totalClassified = 0;
  let totalPublished = 0;
  let totalRejected = 0;
  let totalFailed = 0;
  const errors: string[] = [];

  for (const paper of pendingPapers) {
    try {
      const result = await classifyPaperById(paper.id);

      if (result.status === "published") {
        totalClassified += 1;
        totalPublished += 1;
      } else {
        totalRejected += 1;
        errors.push(`Rejected paper ${paper.id}: ${result.rejectionReason ?? "classification could not be performed"}`);
      }
    } catch (error) {
      totalFailed += 1;
      errors.push(`Failed to classify paper ${paper.id}: ${getErrorMessage(error)}`);
    }
  }

  return {
    totalFound: pendingPapers.length,
    totalClassified,
    totalPublished,
    totalRejected,
    totalFailed,
    errors,
  };
}
