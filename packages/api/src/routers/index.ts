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
const paperIdInputSchema = z.object({
  paperId: z.string().uuid(),
});
const updateReadingProgressInputSchema = paperIdInputSchema.extend({
  progressPercentage: z.number().int().min(0).max(100),
});
const noteTextSchema = z.string().trim().min(1).max(2000);
const noteSectionSchema = z.string().trim().max(100).optional();
const createNoteInputSchema = paperIdInputSchema.extend({
  note: noteTextSchema,
  section: noteSectionSchema,
});
const updateNoteInputSchema = z.object({
  noteId: z.string().uuid(),
  note: noteTextSchema,
  section: noteSectionSchema,
});
const noteIdInputSchema = z.object({
  noteId: z.string().uuid(),
});

type ReadingStatusValue = "not_started" | "reading" | "completed";

const readingProgressSelect = {
  id: true,
  paperId: true,
  status: true,
  progressPercentage: true,
  startedAt: true,
  completedAt: true,
  lastReadAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const bookmarkSelect = {
  id: true,
  paperId: true,
  createdAt: true,
  paper: {
    select: {
      id: true,
      title: true,
      abstract: true,
      authors: true,
      publicationYear: true,
      sourceName: true,
      sourceUrl: true,
      pdfUrl: true,
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
  },
} as const;

const readingNoteSelect = {
  id: true,
  paperId: true,
  note: true,
  section: true,
  createdAt: true,
  updatedAt: true,
} as const;

const profilePaperSelect = {
  id: true,
  title: true,
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
} as const;

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

async function ensurePublishedPaper(paperId: string) {
  const paper = await prisma.paper.findFirst({
    where: {
      id: paperId,
      status: "published",
    },
    select: {
      id: true,
    },
  });

  if (!paper) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Published paper not found",
    });
  }

  return paper;
}

async function ensurePaperExists(paperId: string) {
  const paper = await prisma.paper.findUnique({
    where: {
      id: paperId,
    },
    select: {
      id: true,
    },
  });

  if (!paper) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Paper not found",
    });
  }

  return paper;
}

async function requireOwnedNote(noteId: string, userId: string) {
  const note = await prisma.readingNote.findUnique({
    where: {
      id: noteId,
    },
    select: {
      id: true,
      userId: true,
    },
  });

  if (!note) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Reading note not found",
    });
  }

  if (note.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this reading note",
    });
  }

  return note;
}

function mapBookmark(bookmark: {
  id: string;
  paperId: string;
  createdAt: Date;
  paper: {
    id: string;
    title: string;
    abstract: string;
    authors: unknown;
    publicationYear: number | null;
    sourceName: string;
    sourceUrl: string;
    pdfUrl: string | null;
    category: {
      id: string;
      name: string;
    };
    classification: {
      difficultyLevel: "beginner_friendly" | "moderate" | "difficult" | "expert";
      beginnerScore: number;
      estimatedReadingTime: number;
    } | null;
  };
}) {
  return {
    id: bookmark.id,
    paperId: bookmark.paperId,
    createdAt: bookmark.createdAt,
    paper: {
      ...bookmark.paper,
      authors: toStringArray(bookmark.paper.authors),
    },
  };
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
  }),
  profile: router({
    getOverview: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const [user, bookmarks, readingProgress, completedProgress, totalNotes] = await Promise.all([
        prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        }),
        prisma.bookmark.findMany({
          where: {
            userId,
            paper: {
              status: "published",
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            createdAt: true,
            paper: {
              select: profilePaperSelect,
            },
          },
        }),
        prisma.readingProgress.findMany({
          where: {
            userId,
            status: "reading",
            paper: {
              status: "published",
            },
          },
          orderBy: {
            lastReadAt: "desc",
          },
          select: {
            progressPercentage: true,
            lastReadAt: true,
            paper: {
              select: profilePaperSelect,
            },
          },
        }),
        prisma.readingProgress.findMany({
          where: {
            userId,
            status: "completed",
            paper: {
              status: "published",
            },
          },
          orderBy: {
            completedAt: "desc",
          },
          select: {
            completedAt: true,
            paper: {
              select: profilePaperSelect,
            },
          },
        }),
        prisma.readingNote.count({
          where: {
            userId,
          },
        }),
      ]);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User profile not found",
        });
      }

      return {
        user,
        summary: {
          totalBookmarked: bookmarks.length,
          totalReading: readingProgress.length,
          totalCompleted: completedProgress.length,
          totalNotes,
        },
        bookmarkedPapers: bookmarks.map((bookmark) => ({
          bookmarkId: bookmark.id,
          bookmarkedAt: bookmark.createdAt.toISOString(),
          paper: bookmark.paper,
        })),
        readingPapers: readingProgress.map((progress) => ({
          progressPercentage: progress.progressPercentage,
          lastReadAt: progress.lastReadAt?.toISOString() ?? null,
          paper: progress.paper,
        })),
        completedPapers: completedProgress.map((progress) => ({
          completedAt: progress.completedAt?.toISOString() ?? null,
          paper: progress.paper,
        })),
      };
    }),
  }),
  reading: router({
    start: protectedProcedure.input(paperIdInputSchema).mutation(async ({ ctx, input }) => {
      await ensurePublishedPaper(input.paperId);

      const now = new Date();
      const existing = await prisma.readingProgress.findUnique({
        where: {
          userId_paperId: {
            userId: ctx.session.user.id,
            paperId: input.paperId,
          },
        },
        select: readingProgressSelect,
      });

      if (existing) {
        return await prisma.readingProgress.update({
          where: {
            userId_paperId: {
              userId: ctx.session.user.id,
              paperId: input.paperId,
            },
          },
          data: {
            status: "reading",
            startedAt: existing.startedAt ?? now,
            lastReadAt: now,
          },
          select: readingProgressSelect,
        });
      }

      return await prisma.readingProgress.create({
        data: {
          userId: ctx.session.user.id,
          paperId: input.paperId,
          status: "reading",
          progressPercentage: 0,
          startedAt: now,
          lastReadAt: now,
        },
        select: readingProgressSelect,
      });
    }),
    updateProgress: protectedProcedure.input(updateReadingProgressInputSchema).mutation(async ({ ctx, input }) => {
      await ensurePublishedPaper(input.paperId);

      const now = new Date();
      const existing = await prisma.readingProgress.findUnique({
        where: {
          userId_paperId: {
            userId: ctx.session.user.id,
            paperId: input.paperId,
          },
        },
        select: readingProgressSelect,
      });
      const isCompleted = input.progressPercentage === 100;

      if (existing) {
        return await prisma.readingProgress.update({
          where: {
            userId_paperId: {
              userId: ctx.session.user.id,
              paperId: input.paperId,
            },
          },
          data: {
            status: isCompleted ? "completed" : "reading",
            progressPercentage: input.progressPercentage,
            startedAt: existing.startedAt ?? now,
            completedAt: isCompleted ? (existing.completedAt ?? now) : null,
            lastReadAt: now,
          },
          select: readingProgressSelect,
        });
      }

      return await prisma.readingProgress.create({
        data: {
          userId: ctx.session.user.id,
          paperId: input.paperId,
          status: isCompleted ? "completed" : "reading",
          progressPercentage: input.progressPercentage,
          startedAt: now,
          completedAt: isCompleted ? now : null,
          lastReadAt: now,
        },
        select: readingProgressSelect,
      });
    }),
    complete: protectedProcedure.input(paperIdInputSchema).mutation(async ({ ctx, input }) => {
      await ensurePublishedPaper(input.paperId);

      const now = new Date();
      const existing = await prisma.readingProgress.findUnique({
        where: {
          userId_paperId: {
            userId: ctx.session.user.id,
            paperId: input.paperId,
          },
        },
        select: readingProgressSelect,
      });

      if (existing) {
        return await prisma.readingProgress.update({
          where: {
            userId_paperId: {
              userId: ctx.session.user.id,
              paperId: input.paperId,
            },
          },
          data: {
            status: "completed",
            progressPercentage: 100,
            startedAt: existing.startedAt ?? now,
            completedAt: existing.completedAt ?? now,
            lastReadAt: now,
          },
          select: readingProgressSelect,
        });
      }

      return await prisma.readingProgress.create({
        data: {
          userId: ctx.session.user.id,
          paperId: input.paperId,
          status: "completed",
          progressPercentage: 100,
          startedAt: now,
          completedAt: now,
          lastReadAt: now,
        },
        select: readingProgressSelect,
      });
    }),
    getForPaper: protectedProcedure.input(paperIdInputSchema).query(async ({ ctx, input }) => {
      return await prisma.readingProgress.findUnique({
        where: {
          userId_paperId: {
            userId: ctx.session.user.id,
            paperId: input.paperId,
          },
        },
        select: readingProgressSelect,
      });
    }),
  }),
  bookmark: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const bookmarks = await prisma.bookmark.findMany({
        where: {
          userId: ctx.session.user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: bookmarkSelect,
      });

      return bookmarks.map(mapBookmark);
    }),
    add: protectedProcedure.input(paperIdInputSchema).mutation(async ({ ctx, input }) => {
      await ensurePublishedPaper(input.paperId);

      const bookmark = await prisma.bookmark.upsert({
        where: {
          userId_paperId: {
            userId: ctx.session.user.id,
            paperId: input.paperId,
          },
        },
        update: {},
        create: {
          userId: ctx.session.user.id,
          paperId: input.paperId,
        },
        select: bookmarkSelect,
      });

      return mapBookmark(bookmark);
    }),
    remove: protectedProcedure.input(paperIdInputSchema).mutation(async ({ ctx, input }) => {
      const result = await prisma.bookmark.deleteMany({
        where: {
          userId: ctx.session.user.id,
          paperId: input.paperId,
        },
      });

      return {
        success: true,
        removed: result.count > 0,
      };
    }),
    getForPaper: protectedProcedure.input(paperIdInputSchema).query(async ({ ctx, input }) => {
      const bookmark = await prisma.bookmark.findUnique({
        where: {
          userId_paperId: {
            userId: ctx.session.user.id,
            paperId: input.paperId,
          },
        },
        select: {
          id: true,
          createdAt: true,
        },
      });

      return {
        isBookmarked: Boolean(bookmark),
        bookmark,
      };
    }),
  }),
  notes: router({
    listMineGroupedByPaper: protectedProcedure.query(async ({ ctx }) => {
      const notes = await prisma.readingNote.findMany({
        where: {
          userId: ctx.session.user.id,
        },
        orderBy: {
          updatedAt: "desc",
        },
        select: {
          id: true,
          note: true,
          section: true,
          createdAt: true,
          updatedAt: true,
          paper: {
            select: {
              id: true,
              title: true,
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
          },
        },
      });

      const paperGroups = new Map<
        string,
        {
          paper: (typeof notes)[number]["paper"];
          noteCount: number;
          latestUpdatedAt: string;
          notes: Array<{
            id: string;
            note: string;
            section: string | null;
            createdAt: string;
            updatedAt: string;
          }>;
        }
      >();

      for (const note of notes) {
        let group = paperGroups.get(note.paper.id);

        if (!group) {
          group = {
            paper: note.paper,
            noteCount: 0,
            latestUpdatedAt: note.updatedAt.toISOString(),
            notes: [],
          };
          paperGroups.set(note.paper.id, group);
        }

        group.noteCount += 1;
        group.notes.push({
          id: note.id,
          note: note.note,
          section: note.section,
          createdAt: note.createdAt.toISOString(),
          updatedAt: note.updatedAt.toISOString(),
        });
      }

      return {
        papers: Array.from(paperGroups.values()),
      };
    }),
    listForPaper: protectedProcedure.input(paperIdInputSchema).query(async ({ ctx, input }) => {
      await ensurePaperExists(input.paperId);

      return await prisma.readingNote.findMany({
        where: {
          userId: ctx.session.user.id,
          paperId: input.paperId,
        },
        orderBy: {
          createdAt: "desc",
        },
        select: readingNoteSelect,
      });
    }),
    create: protectedProcedure.input(createNoteInputSchema).mutation(async ({ ctx, input }) => {
      await ensurePublishedPaper(input.paperId);

      return await prisma.readingNote.create({
        data: {
          userId: ctx.session.user.id,
          paperId: input.paperId,
          note: input.note,
          section: input.section || null,
        },
        select: readingNoteSelect,
      });
    }),
    update: protectedProcedure.input(updateNoteInputSchema).mutation(async ({ ctx, input }) => {
      await requireOwnedNote(input.noteId, ctx.session.user.id);

      return await prisma.readingNote.update({
        where: {
          id: input.noteId,
          userId: ctx.session.user.id,
        },
        data: {
          note: input.note,
          ...(input.section !== undefined ? { section: input.section || null } : {}),
        },
        select: readingNoteSelect,
      });
    }),
    delete: protectedProcedure.input(noteIdInputSchema).mutation(async ({ ctx, input }) => {
      await requireOwnedNote(input.noteId, ctx.session.user.id);

      await prisma.readingNote.delete({
        where: {
          id: input.noteId,
          userId: ctx.session.user.id,
        },
      });

      return {
        success: true,
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
