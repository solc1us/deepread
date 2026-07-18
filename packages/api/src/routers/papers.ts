import prisma from "@deepread/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { publicProcedure, router } from "../index";
import { paperSearchQuerySchema } from "../paper-search-validation";
import { difficultyLevelSchema, paperSortSchema, toStringArray, type ReadingStatusValue } from "./shared";

export const papersRouter = router({
  list: publicProcedure
    .input(
      z.object({
        q: paperSearchQuerySchema,
        categoryId: z.string().uuid().optional(),
        difficulty: difficultyLevelSchema.optional(),
        sort: paperSortSchema.default("newest"),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(50).default(10),
      }),
    )
    .query(async ({ ctx, input }) => {
      const sessionUserId = ctx.session?.user.id ?? null;
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

      const progressByPaperId = new Map<string, { status: ReadingStatusValue; progressPercentage: number }>();
      const bookmarkedPaperIds = new Set<string>();

      if (sessionUserId && papers.length > 0) {
        const paperIds = papers.map((paper) => paper.id);
        const [readingProgress, bookmarks] = await Promise.all([
          prisma.readingProgress.findMany({
            where: {
              userId: sessionUserId,
              paperId: {
                in: paperIds,
              },
            },
            select: {
              paperId: true,
              status: true,
              progressPercentage: true,
            },
          }),
          prisma.bookmark.findMany({
            where: {
              userId: sessionUserId,
              paperId: {
                in: paperIds,
              },
            },
            select: {
              paperId: true,
            },
          }),
        ]);

        for (const progress of readingProgress) {
          progressByPaperId.set(progress.paperId, {
            status: progress.status as ReadingStatusValue,
            progressPercentage: progress.progressPercentage,
          });
        }

        for (const bookmark of bookmarks) {
          bookmarkedPaperIds.add(bookmark.paperId);
        }
      }

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
          userProgress: progressByPaperId.get(paper.id) ?? null,
          isBookmarked: bookmarkedPaperIds.has(paper.id),
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
    .query(async ({ ctx, input }) => {
      const sessionUserId = ctx.session?.user.id ?? null;
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
        },
      });

      if (!paper) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Paper not found",
        });
      }

      let userProgress: {
        status: ReadingStatusValue;
        progressPercentage: number;
        startedAt: Date | null;
        completedAt: Date | null;
        lastReadAt: Date | null;
      } | null = null;
      let isBookmarked = false;

      if (sessionUserId) {
        const [readingProgress, bookmark] = await Promise.all([
          prisma.readingProgress.findUnique({
            where: {
              userId_paperId: {
                userId: sessionUserId,
                paperId: paper.id,
              },
            },
            select: {
              status: true,
              progressPercentage: true,
              startedAt: true,
              completedAt: true,
              lastReadAt: true,
            },
          }),
          prisma.bookmark.findUnique({
            where: {
              userId_paperId: {
                userId: sessionUserId,
                paperId: paper.id,
              },
            },
            select: {
              id: true,
            },
          }),
        ]);

        userProgress = readingProgress
          ? {
              ...readingProgress,
              status: readingProgress.status as ReadingStatusValue,
            }
          : null;
        isBookmarked = Boolean(bookmark);
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
        userProgress,
        isBookmarked,
      };
    }),
});
