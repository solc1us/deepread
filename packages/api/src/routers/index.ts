import prisma from "@deepread/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, protectedProcedure, publicProcedure, router } from "../index";
import { runOpenAlexIngestion } from "../services/openalex-ingestion";
import { classifyPaperById, classifyPendingPapers } from "../services/paper-classification";
import { classifyPaperDifficulty } from "../services/paper-difficulty-classifier";

const difficultyLevelSchema = z.enum(["beginner_friendly", "moderate", "difficult", "expert"]);
const paperSortSchema = z.enum(["beginner_score", "newest", "title"]);
const adminIngestionInputSchema = z.object({
  categoryId: z.string().uuid(),
  query: z.string().trim().min(1),
  limit: z.number().int().min(1).max(50).default(10),
});
const ingestionLogsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(20),
  })
  .optional();
const adminClassificationRunForPaperInputSchema = z.object({
  paperId: z.string().uuid(),
});
const adminClassificationRunBatchInputSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(10),
    categoryId: z.string().uuid().optional(),
  })
  .optional();
const adminClassificationPreviewInputSchema = z.object({
  title: z.string().trim().min(1),
  abstract: z.string().trim().min(1),
  keywords: z.array(z.string().trim().min(1)).default([]),
  categoryName: z.string().trim().min(1).optional(),
  publicationYear: z.number().int().min(1900).max(2100).nullable().optional(),
});

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return {
      status: "ok",
    };
  }),
  categories: router({
    list: publicProcedure.query(async () => {
      const categories = await prisma.category.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          description: true,
          _count: {
            select: {
              papers: true,
            },
          },
        },
      });

      return categories.map((category) => ({
        id: category.id,
        name: category.name,
        description: category.description,
        paperCount: category._count.papers,
      }));
    }),
  }),
  papers: router({
    list: publicProcedure
      .input(
        z.object({
          q: z.string().trim().optional(),
          categoryId: z.string().uuid().optional(),
          difficulty: difficultyLevelSchema.optional(),
          sort: paperSortSchema.default("newest"),
          page: z.number().int().min(1).default(1),
          limit: z.number().int().min(1).max(50).default(10),
        }),
      )
      .query(async ({ input }) => {
        const where = {
          status: "published" as const,
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
          ...(input.difficulty
            ? {
                classification: {
                  difficultyLevel: input.difficulty,
                },
              }
            : {}),
          ...(input.q
            ? {
                OR: [
                  {
                    title: {
                      contains: input.q,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    abstract: {
                      contains: input.q,
                      mode: "insensitive" as const,
                    },
                  },
                  {
                    sourceName: {
                      contains: input.q,
                      mode: "insensitive" as const,
                    },
                  },
                ],
              }
            : {}),
        };

        const orderBy =
          input.sort === "title"
            ? { title: "asc" as const }
            : input.sort === "beginner_score"
              ? { classification: { beginnerScore: "desc" as const } }
              : { createdAt: "desc" as const };

        const [papers, total] = await Promise.all([
          prisma.paper.findMany({
            where,
            orderBy,
            skip: (input.page - 1) * input.limit,
            take: input.limit,
            select: {
              id: true,
              title: true,
              abstract: true,
              authors: true,
              publicationYear: true,
              sourceName: true,
              sourceUrl: true,
              createdAt: true,
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
                  estimatedReadingTime: true,
                },
              },
            },
          }),
          prisma.paper.count({
            where,
          }),
        ]);

        return {
          papers: papers.map((paper) => ({
            id: paper.id,
            title: paper.title,
            abstract: paper.abstract,
            authors: toStringArray(paper.authors),
            publicationYear: paper.publicationYear,
            sourceName: paper.sourceName,
            sourceUrl: paper.sourceUrl,
            category: paper.category,
            difficultyLevel: paper.classification?.difficultyLevel ?? null,
            beginnerScore: paper.classification?.beginnerScore ?? null,
            estimatedReadingTime: paper.classification?.estimatedReadingTime ?? null,
          })),
          pagination: {
            page: input.page,
            limit: input.limit,
            total,
            totalPages: Math.ceil(total / input.limit),
          },
        };
      }),
    detail: publicProcedure
      .input(
        z.object({
          id: z.string().uuid(),
        }),
      )
      .query(async ({ input }) => {
        const paper = await prisma.paper.findFirst({
          where: {
            id: input.id,
            status: "published",
          },
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
                estimatedReadingTime: true,
                classificationReason: true,
                readingWarning: true,
                recommendedReader: true,
              },
            },
            sources: {
              orderBy: {
                fetchedAt: "desc",
              },
              select: {
                id: true,
                provider: true,
                externalId: true,
                fetchedAt: true,
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

        return {
          id: paper.id,
          title: paper.title,
          abstract: paper.abstract,
          authors: toStringArray(paper.authors),
          publicationYear: paper.publicationYear,
          doi: paper.doi,
          sourceName: paper.sourceName,
          sourceUrl: paper.sourceUrl,
          pdfUrl: paper.pdfUrl,
          keywords: toStringArray(paper.keywords),
          language: paper.language,
          category: paper.category,
          classification: paper.classification,
          sources: paper.sources,
        };
      }),
  }),
  admin: router({
    ingestion: router({
      runOpenAlex: adminProcedure.input(adminIngestionInputSchema).mutation(async ({ input }) => {
        return await runOpenAlexIngestion(input);
      }),
      logs: adminProcedure.input(ingestionLogsInputSchema).query(async ({ input }) => {
        const logs = await prisma.ingestionLog.findMany({
          orderBy: {
            startedAt: "desc",
          },
          take: input?.limit ?? 20,
          select: {
            id: true,
            provider: true,
            status: true,
            totalFetched: true,
            totalSaved: true,
            totalRejected: true,
            errorMessage: true,
            startedAt: true,
            finishedAt: true,
          },
        });

        return logs;
      }),
    }),
    classification: router({
      runForPaper: adminProcedure.input(adminClassificationRunForPaperInputSchema).mutation(async ({ input }) => {
        try {
          return await classifyPaperById(input.paperId);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("Paper not found:")) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Paper not found",
            });
          }

          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to classify paper",
          });
        }
      }),
      runBatch: adminProcedure.input(adminClassificationRunBatchInputSchema).mutation(async ({ input }) => {
        return await classifyPendingPapers(input ?? {});
      }),
      preview: adminProcedure.input(adminClassificationPreviewInputSchema).mutation(({ input }) => {
        return classifyPaperDifficulty(input);
      }),
    }),
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
});
export type AppRouter = typeof appRouter;
