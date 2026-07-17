import prisma from "@deepread/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, router } from "../../index";
import {
  CLASSIFICATION_VERSION,
  classifyPaperById,
  PaperClassificationServiceError,
} from "../../services/paper-classification";
import { classifyPaperDifficultyV2 } from "../../services/paper-difficulty-classifier";
import { difficultyLevelSchema } from "../shared";

const MANUAL_CLASSIFICATION_VERSION = "manual-admin-v1";
const MIN_MANUAL_REASON_LENGTH = 20;
const MIN_PUBLICATION_YEAR = 1900;
const MAX_PUBLICATION_YEAR = 2100;

const paperStatusSchema = z.enum(["pending", "needs_review", "published", "rejected", "inactive"]);
type PaperStatus = z.infer<typeof paperStatusSchema>;
const paperIdInputSchema = z.object({
  paperId: z.string().uuid(),
});

const httpUrlSchema = z
  .string()
  .trim()
  .url("Enter a valid URL")
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  }, "URL must use HTTP or HTTPS");

const updateMetadataInputSchema = z
  .object({
    paperId: z.string().uuid(),
    authors: z.array(z.string()).optional(),
    abstract: z.string().trim().min(1, "Abstract cannot be blank").optional(),
    publicationYear: z
      .number()
      .int()
      .min(MIN_PUBLICATION_YEAR)
      .max(MAX_PUBLICATION_YEAR)
      .nullable()
      .optional(),
    sourceUrl: httpUrlSchema.nullable().optional(),
    pdfUrl: httpUrlSchema.nullable().optional(),
  })
  .refine(
    (input) =>
      input.authors !== undefined ||
      input.abstract !== undefined ||
      input.publicationYear !== undefined ||
      input.sourceUrl !== undefined ||
      input.pdfUrl !== undefined,
    {
      message: "At least one metadata field must be provided",
    },
  );

const manualClassifyInputSchema = paperIdInputSchema.extend({
  difficulty: difficultyLevelSchema,
  reason: z
    .string()
    .trim()
    .min(MIN_MANUAL_REASON_LENGTH, `Reason must be at least ${MIN_MANUAL_REASON_LENGTH} characters`)
    .max(2000),
});

const adminPaperListInputSchema = z.object({
  status: paperStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  difficulty: difficultyLevelSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

const statusChangePaperSelect = {
  id: true,
  status: true,
  classification: {
    select: {
      difficultyLevel: true,
      beginnerScore: true,
      classificationVersion: true,
      classificationReason: true,
    },
  },
} as const;

function hasValidClassification(
  classification: {
    difficultyLevel: string;
    beginnerScore: number | null;
    classificationVersion: string;
    classificationReason: string;
  } | null,
) {
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

function normalizeAuthors(authors: unknown) {
  if (!Array.isArray(authors)) {
    return [];
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const author of authors) {
    if (typeof author !== "string") {
      continue;
    }

    const name = author.trim();
    const key = name.toLocaleLowerCase();

    if (!name || !/[\p{L}\p{N}]/u.test(name) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(name);
  }

  return normalized;
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function requireUsableAuthors(authors: unknown) {
  if (
    Array.isArray(authors) &&
    authors.some((author) => typeof author === "string" && author.trim() && !/[\p{L}\p{N}]/u.test(author))
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Author names cannot contain only punctuation",
    });
  }

  const normalized = normalizeAuthors(authors);

  if (normalized.length === 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "At least one usable author is required",
    });
  }

  return normalized;
}

function isHttpUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function getMetadataAuditValues(paper: {
  authors: unknown;
  abstract: string;
  publicationYear: number | null;
  sourceUrl: string;
  pdfUrl: string | null;
}) {
  return {
    authorCount: normalizeAuthors(paper.authors).length,
    abstractLength: paper.abstract.trim().length,
    publicationYear: paper.publicationYear,
    hasSourceUrl: Boolean(paper.sourceUrl.trim()),
    hasPdfUrl: Boolean(paper.pdfUrl?.trim()),
  };
}

async function getPaperForStatusChange(paperId: string) {
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    select: statusChangePaperSelect,
  });

  if (!paper) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Paper not found",
    });
  }

  return paper;
}

async function changePaperStatus(input: {
  adminUserId: string;
  paper: Awaited<ReturnType<typeof getPaperForStatusChange>>;
  nextStatus: PaperStatus;
  reason: string;
}) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.paper.updateMany({
        where: {
          id: input.paper.id,
          status: input.paper.status,
        },
        data: { status: input.nextStatus },
      });

      if (updateResult.count !== 1) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Paper status changed before this action completed. Refresh and try again.",
        });
      }

      await transaction.adminPaperAuditLog.create({
        data: {
          adminUserId: input.adminUserId,
          action: "paper_status_changed",
          paperId: input.paper.id,
          previousValues: { status: input.paper.status },
          newValues: { status: input.nextStatus },
          reason: input.reason,
        },
      });

      return {
        id: input.paper.id,
        status: input.nextStatus,
      };
    });
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to change paper status",
    });
  }
}

export const adminPapersRouter = router({
  list: adminProcedure.input(adminPaperListInputSchema).query(async ({ input }) => {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.difficulty
        ? {
            classification: {
              difficultyLevel: input.difficulty,
            },
          }
        : {}),
    };

    const [papers, total] = await Promise.all([
      prisma.paper.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
          classification: {
            select: {
              difficultyLevel: true,
              beginnerScore: true,
              classificationVersion: true,
              classificationReason: true,
            },
          },
        },
      }),
      prisma.paper.count({ where }),
    ]);

    return {
      papers: papers.map((paper) => ({
        id: paper.id,
        title: paper.title,
        status: paper.status,
        createdAt: paper.createdAt.toISOString(),
        updatedAt: paper.updatedAt.toISOString(),
        category: paper.category,
        classification: paper.classification
          ? {
              difficultyLevel: paper.classification.difficultyLevel,
              beginnerScore: paper.classification.beginnerScore,
            }
          : null,
        hasValidClassification: hasValidClassification(paper.classification),
        difficultyLevel: paper.classification?.difficultyLevel ?? null,
        beginnerScore: paper.classification?.beginnerScore ?? null,
      })),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }),
  detail: adminProcedure.input(paperIdInputSchema).query(async ({ input }) => {
    const paper = await prisma.paper.findUnique({
      where: { id: input.paperId },
      select: {
        id: true,
        title: true,
        abstract: true,
        authors: true,
        publicationYear: true,
        doi: true,
        sourceName: true,
        sourceUrl: true,
        pdfUrl: true,
        keywords: true,
        language: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        sources: {
          orderBy: {
            createdAt: "asc",
          },
          take: 1,
          select: {
            provider: true,
            externalId: true,
          },
        },
        classification: {
          select: {
            difficultyLevel: true,
            beginnerScore: true,
            estimatedReadingTime: true,
            classificationReason: true,
            readingWarning: true,
            recommendedReader: true,
            classificationVersion: true,
          },
        },
      },
    });

    if (!paper) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Paper not found",
      });
    }

    let reviewReasons: string[] = [];
    let reviewClassificationVersion: string | null = null;

    if (paper.status === "needs_review") {
      try {
        const reviewResult = classifyPaperDifficultyV2({
          title: paper.title,
          abstract: paper.abstract,
          keywords: normalizeStringArray(paper.keywords),
          categoryName: paper.category.name,
          publicationYear: paper.publicationYear,
        });

        reviewClassificationVersion = reviewResult.classificationVersion;
        reviewReasons = reviewResult.outcome === "needs_review"
          ? reviewResult.reviewReasons
          : ["Current metadata passes review. Re-run the classifier to publish this paper."];
      } catch {
        reviewReasons = ["Current metadata could not be evaluated for review."];
      }
    }

    return {
      paperId: paper.id,
      title: paper.title,
      abstract: paper.abstract,
      authors: normalizeAuthors(paper.authors),
      publicationYear: paper.publicationYear,
      category: paper.category,
      status: paper.status,
      sourceName: paper.sourceName,
      sourceUrl: paper.sourceUrl,
      pdfUrl: paper.pdfUrl,
      doi: paper.doi,
      provider: paper.sources[0]?.provider ?? null,
      externalId: paper.sources[0]?.externalId ?? null,
      language: paper.language,
      createdAt: paper.createdAt.toISOString(),
      updatedAt: paper.updatedAt.toISOString(),
      classification: paper.classification,
      reviewReasons,
      reviewClassificationVersion,
    };
  }),
  updateMetadata: adminProcedure.input(updateMetadataInputSchema).mutation(async ({ ctx, input }) => {
    if (input.sourceUrl === null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Source URL cannot be removed",
      });
    }

    const normalizedAuthors = input.authors === undefined ? undefined : requireUsableAuthors(input.authors);

    try {
      return await prisma.$transaction(async (transaction) => {
        const paper = await transaction.paper.findUnique({
          where: { id: input.paperId },
          select: {
            id: true,
            title: true,
            status: true,
            authors: true,
            abstract: true,
            publicationYear: true,
            sourceUrl: true,
            pdfUrl: true,
          },
        });

        if (!paper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Paper not found",
          });
        }

        const updated = await transaction.paper.update({
          where: { id: paper.id },
          data: {
            ...(normalizedAuthors !== undefined ? { authors: normalizedAuthors } : {}),
            ...(input.abstract !== undefined ? { abstract: input.abstract } : {}),
            ...(input.publicationYear !== undefined ? { publicationYear: input.publicationYear } : {}),
            ...(typeof input.sourceUrl === "string" ? { sourceUrl: input.sourceUrl } : {}),
            ...(input.pdfUrl !== undefined ? { pdfUrl: input.pdfUrl } : {}),
          },
          select: {
            id: true,
            title: true,
            status: true,
            authors: true,
            abstract: true,
            publicationYear: true,
            sourceUrl: true,
            pdfUrl: true,
            updatedAt: true,
          },
        });

        await transaction.adminPaperAuditLog.create({
          data: {
            adminUserId: ctx.adminUser.id,
            action: "paper_metadata_updated",
            paperId: paper.id,
            previousValues: getMetadataAuditValues(paper),
            newValues: getMetadataAuditValues(updated),
          },
        });

        return {
          paperId: updated.id,
          title: updated.title,
          status: updated.status,
          authors: normalizeAuthors(updated.authors),
          abstractLength: updated.abstract.trim().length,
          publicationYear: updated.publicationYear,
          sourceUrl: updated.sourceUrl,
          pdfUrl: updated.pdfUrl,
          updatedAt: updated.updatedAt,
        };
      });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update paper metadata",
      });
    }
  }),
  reclassify: adminProcedure.input(paperIdInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const result = await classifyPaperById(input.paperId, {
        allowedStatuses: ["pending", "needs_review", "published"],
        audit: {
          adminUserId: ctx.adminUser.id,
          action: "paper_reclassified",
        },
      });

      if (result.status === "rejected") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Paper metadata could not be classified",
        });
      }

      return {
        outcome: result.status,
        paperId: result.paperId,
        status: result.status,
        classificationVersion: result.status === "published" ? (result.classificationVersion ?? CLASSIFICATION_VERSION) : null,
        difficulty: result.classification?.difficultyLevel ?? null,
        reviewReasons: result.reviewReasons ?? [],
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      if (error instanceof PaperClassificationServiceError) {
        throw new TRPCError({
          code: error.code === "PAPER_NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
          message: error.message,
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to reclassify paper",
      });
    }
  }),
  manualClassifyAndPublish: adminProcedure.input(manualClassifyInputSchema).mutation(async ({ ctx, input }) => {
    try {
      return await prisma.$transaction(async (transaction) => {
        const paper = await transaction.paper.findUnique({
          where: { id: input.paperId },
          select: {
            id: true,
            title: true,
            abstract: true,
            authors: true,
            sourceUrl: true,
            status: true,
            classification: {
              select: {
                difficultyLevel: true,
                classificationVersion: true,
              },
            },
          },
        });

        if (!paper) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Paper not found",
          });
        }

        if (paper.status !== "needs_review" && paper.status !== "pending") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Only pending or needs-review papers can be manually classified",
          });
        }

        requireUsableAuthors(paper.authors);

        if (!paper.title.trim() || !paper.abstract.trim() || !isHttpUrl(paper.sourceUrl)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Paper title, abstract, authors, and source URL are required before publication",
          });
        }

        await transaction.paperClassification.upsert({
          where: { paperId: paper.id },
          update: {
            difficultyLevel: input.difficulty,
            beginnerScore: null,
            estimatedReadingTime: null,
            abstractLengthScore: null,
            sentenceComplexityScore: null,
            jargonDensityScore: null,
            methodologyComplexityScore: null,
            statisticalComplexityScore: null,
            prerequisiteScore: null,
            clarityScore: null,
            classificationReason: input.reason,
            readingWarning: null,
            recommendedReader: null,
            classificationVersion: MANUAL_CLASSIFICATION_VERSION,
          },
          create: {
            paperId: paper.id,
            difficultyLevel: input.difficulty,
            beginnerScore: null,
            estimatedReadingTime: null,
            abstractLengthScore: null,
            sentenceComplexityScore: null,
            jargonDensityScore: null,
            methodologyComplexityScore: null,
            statisticalComplexityScore: null,
            prerequisiteScore: null,
            clarityScore: null,
            classificationReason: input.reason,
            readingWarning: null,
            recommendedReader: null,
            classificationVersion: MANUAL_CLASSIFICATION_VERSION,
          },
        });

        await transaction.paper.update({
          where: { id: paper.id, status: paper.status },
          data: { status: "published" },
        });

        await transaction.adminPaperAuditLog.create({
          data: {
            adminUserId: ctx.adminUser.id,
            action: "paper_manually_classified",
            paperId: paper.id,
            previousValues: {
              status: paper.status,
              classificationVersion: paper.classification?.classificationVersion ?? null,
              difficulty: paper.classification?.difficultyLevel ?? null,
            },
            newValues: {
              status: "published",
              classificationVersion: MANUAL_CLASSIFICATION_VERSION,
              difficulty: input.difficulty,
            },
            reason: input.reason,
          },
        });

        return {
          paperId: paper.id,
          status: "published" as const,
          difficulty: input.difficulty,
          classificationVersion: MANUAL_CLASSIFICATION_VERSION,
        };
      });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to publish manual classification",
      });
    }
  }),
  deactivate: adminProcedure.input(paperIdInputSchema).mutation(async ({ ctx, input }) => {
    const paper = await getPaperForStatusChange(input.paperId);

    if (paper.status !== "published" && paper.status !== "needs_review") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only published or needs-review papers can be deactivated",
      });
    }

    return await changePaperStatus({
      adminUserId: ctx.adminUser.id,
      paper,
      nextStatus: "inactive",
      reason: "Paper deactivated by admin",
    });
  }),
  reactivate: adminProcedure.input(paperIdInputSchema).mutation(async ({ ctx, input }) => {
    const paper = await getPaperForStatusChange(input.paperId);

    if (paper.status !== "inactive") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only inactive papers can be reactivated",
      });
    }

    return await changePaperStatus({
      adminUserId: ctx.adminUser.id,
      paper,
      nextStatus: hasValidClassification(paper.classification) ? "published" : "needs_review",
      reason: "Paper reactivated by admin",
    });
  }),
  reject: adminProcedure.input(paperIdInputSchema).mutation(async ({ ctx, input }) => {
    const paper = await getPaperForStatusChange(input.paperId);

    if (paper.status !== "needs_review") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only needs-review papers can be rejected",
      });
    }

    return await changePaperStatus({
      adminUserId: ctx.adminUser.id,
      paper,
      nextStatus: "rejected",
      reason: "Needs-review paper rejected by admin",
    });
  }),
  publish: adminProcedure.input(paperIdInputSchema).mutation(async ({ input }) => {
    await getPaperForStatusChange(input.paperId);
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use reclassification or manual classification to publish a paper",
    });
  }),
});
