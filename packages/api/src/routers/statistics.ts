import prisma from "@deepread/db";

import { protectedProcedure, router } from "../index";
import { profilePaperSelect } from "./shared";

type DifficultyLevelValue = "beginner_friendly" | "moderate" | "difficult" | "expert";
type ActivityType = "started" | "progress" | "completed" | "bookmarked" | "note_created";

const difficultyLevels: DifficultyLevelValue[] = ["beginner_friendly", "moderate", "difficult", "expert"];
const recentActivityLimit = 30;

function toIsoDate(date: Date | null) {
  return date?.toISOString() ?? null;
}

export const statisticsRouter = router({
  getMine: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const publishedPaperWhere = {
      status: "published" as const,
    };

    const [readingProgress, totalBookmarked, totalNotes, recentBookmarks, recentNotes] = await Promise.all([
      prisma.readingProgress.findMany({
        where: {
          userId,
          status: {
            in: ["reading", "completed"],
          },
          paper: publishedPaperWhere,
        },
        orderBy: {
          lastReadAt: "desc",
        },
        select: {
          status: true,
          progressPercentage: true,
          startedAt: true,
          completedAt: true,
          lastReadAt: true,
          paper: {
            select: profilePaperSelect,
          },
        },
      }),
      prisma.bookmark.count({
        where: {
          userId,
          paper: publishedPaperWhere,
        },
      }),
      prisma.readingNote.count({
        where: {
          userId,
          paper: publishedPaperWhere,
        },
      }),
      prisma.bookmark.findMany({
        where: {
          userId,
          paper: publishedPaperWhere,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: recentActivityLimit,
        select: {
          createdAt: true,
          paper: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.readingNote.findMany({
        where: {
          userId,
          paper: publishedPaperWhere,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: recentActivityLimit,
        select: {
          createdAt: true,
          paper: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
    ]);

    const completedProgress = readingProgress.filter((progress) => progress.status === "completed");
    const activeProgress = readingProgress.filter((progress) => progress.status === "reading");
    const estimatedCompletedReadingTime = completedProgress.reduce(
      (total, progress) => total + (progress.paper.classification?.estimatedReadingTime ?? 0),
      0,
    );
    const averageReadingProgress =
      readingProgress.length > 0
        ? Math.round(
            readingProgress.reduce((total, progress) => total + progress.progressPercentage, 0) /
              readingProgress.length,
          )
        : 0;

    const difficultyCounts = new Map<DifficultyLevelValue, number>(
      difficultyLevels.map((difficultyLevel) => [difficultyLevel, 0]),
    );
    for (const progress of completedProgress) {
      const difficultyLevel = progress.paper.classification?.difficultyLevel as DifficultyLevelValue | undefined;
      if (difficultyLevel) {
        difficultyCounts.set(difficultyLevel, (difficultyCounts.get(difficultyLevel) ?? 0) + 1);
      }
    }

    const categoryCounts = new Map<string, { categoryId: string; categoryName: string; count: number }>();
    for (const progress of readingProgress) {
      const category = progress.paper.category;
      const existing = categoryCounts.get(category.id);
      categoryCounts.set(category.id, {
        categoryId: category.id,
        categoryName: category.name,
        count: (existing?.count ?? 0) + 1,
      });
    }

    const recentActivity: Array<{
      type: ActivityType;
      date: string;
      paper: {
        id: string;
        title: string;
      };
    }> = [];

    for (const progress of readingProgress) {
      if (progress.startedAt) {
        recentActivity.push({
          type: "started",
          date: progress.startedAt.toISOString(),
          paper: {
            id: progress.paper.id,
            title: progress.paper.title,
          },
        });
      }

      if (
        progress.status === "reading" &&
        progress.lastReadAt &&
        progress.lastReadAt.getTime() !== progress.startedAt?.getTime()
      ) {
        recentActivity.push({
          type: "progress",
          date: progress.lastReadAt.toISOString(),
          paper: {
            id: progress.paper.id,
            title: progress.paper.title,
          },
        });
      }

      if (progress.status === "completed" && progress.completedAt) {
        recentActivity.push({
          type: "completed",
          date: progress.completedAt.toISOString(),
          paper: {
            id: progress.paper.id,
            title: progress.paper.title,
          },
        });
      }
    }

    for (const bookmark of recentBookmarks) {
      recentActivity.push({
        type: "bookmarked",
        date: bookmark.createdAt.toISOString(),
        paper: bookmark.paper,
      });
    }

    for (const note of recentNotes) {
      recentActivity.push({
        type: "note_created",
        date: note.createdAt.toISOString(),
        paper: note.paper,
      });
    }

    return {
      summary: {
        totalCompleted: completedProgress.length,
        totalReading: activeProgress.length,
        totalBookmarked,
        totalNotes,
        estimatedCompletedReadingTime,
        averageReadingProgress,
      },
      difficultyDistribution: difficultyLevels.map((difficultyLevel) => ({
        difficultyLevel,
        count: difficultyCounts.get(difficultyLevel) ?? 0,
      })),
      categoryDistribution: Array.from(categoryCounts.values()).sort((a, b) => b.count - a.count),
      recentReadingActivity: recentActivity
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, recentActivityLimit),
      recentCompletedPapers: completedProgress
        .filter((progress) => progress.completedAt)
        .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))
        .slice(0, 5)
        .map((progress) => ({
          completedAt: toIsoDate(progress.completedAt),
          paper: {
            ...progress.paper,
            classification: progress.paper.classification
              ? {
                  difficultyLevel: progress.paper.classification.difficultyLevel,
                  beginnerScore: progress.paper.classification.beginnerScore,
                  estimatedReadingTime: progress.paper.classification.estimatedReadingTime,
                }
              : null,
          },
        })),
    };
  }),
});
