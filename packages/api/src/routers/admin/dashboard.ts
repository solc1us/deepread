import prisma from "@deepread/db";

import { adminProcedure, router } from "../../index";

type PaperStatusValue = "pending" | "needs_review" | "published" | "rejected" | "inactive";
type DifficultyLevelValue = "beginner_friendly" | "moderate" | "difficult" | "expert";
type IngestionStatusValue = "success" | "failed" | "partial";

const paperStatuses: PaperStatusValue[] = ["published", "pending", "needs_review", "rejected", "inactive"];
const difficultyLevels: DifficultyLevelValue[] = ["beginner_friendly", "moderate", "difficult", "expert"];
const ingestionStatuses: IngestionStatusValue[] = ["success", "failed", "partial"];

function toIsoDate(date: Date | null) {
  return date?.toISOString() ?? null;
}

function countByKey<T extends string>(groups: Array<{ key: T; count: number }>) {
  return new Map(groups.map((group) => [group.key, group.count]));
}

type DatabaseHealth = {
  status: "connected" | "disconnected";
  checkedAt: string;
  message?: "Database health check failed";
};

async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const checkedAt = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "connected", checkedAt };
  } catch {
    return {
      status: "disconnected",
      checkedAt,
      message: "Database health check failed",
    };
  }
}

export const adminDashboardRouter = router({
  getOverview: adminProcedure.query(async () => {
    const databaseHealth = await checkDatabaseHealth();

    if (databaseHealth.status === "disconnected") {
      return {
        paperStatusSummary: {
          totalPapers: 0,
          publishedPapers: 0,
          pendingPapers: 0,
          needsReviewPapers: 0,
          rejectedPapers: 0,
          inactivePapers: 0,
        },
        classificationSummary: {
          classifiedPapers: 0,
          unclassifiedPapers: 0,
          beginnerFriendly: 0,
          moderate: 0,
          difficult: 0,
          expert: 0,
        },
        categoryDistribution: [],
        difficultyDistribution: difficultyLevels.map((difficultyLevel) => ({ difficultyLevel, count: 0 })),
        ingestionOverview: {
          lastIngestionStatus: null,
          lastIngestionAt: null,
          totalIngestionRuns: 0,
          successfulRuns: 0,
          failedRuns: 0,
          partialRuns: 0,
        },
        latestIngestionLogs: [],
        recentPapers: [],
        engagementSnapshot: {
          totalReadingProgress: 0,
          totalBookmarks: 0,
          totalNotes: 0,
          completedReadings: 0,
        },
        systemHealth: {
          database: databaseHealth,
        },
      };
    }

    const [
      paperStatusGroups,
      classifiedPapers,
      difficultyGroups,
      categories,
      categoryStatusGroups,
      ingestionStatusGroups,
      lastIngestion,
      latestIngestionLogs,
      recentPapers,
      totalReadingProgress,
      totalBookmarks,
      totalNotes,
      completedReadings,
    ] = await Promise.all([
      prisma.paper.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      prisma.paperClassification.count(),
      prisma.paperClassification.groupBy({
        by: ["difficultyLevel"],
        _count: {
          _all: true,
        },
      }),
      prisma.category.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
        },
      }),
      prisma.paper.groupBy({
        by: ["categoryId", "status"],
        _count: {
          _all: true,
        },
      }),
      prisma.ingestionLog.groupBy({
        by: ["status"],
        _count: {
          _all: true,
        },
      }),
      prisma.ingestionLog.findFirst({
        orderBy: {
          startedAt: "desc",
        },
        select: {
          status: true,
          startedAt: true,
        },
      }),
      prisma.ingestionLog.findMany({
        orderBy: {
          startedAt: "desc",
        },
        take: 10,
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
      }),
      prisma.paper.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        select: {
          id: true,
          title: true,
          status: true,
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
            },
          },
        },
      }),
      prisma.readingProgress.count(),
      prisma.bookmark.count(),
      prisma.readingNote.count(),
      prisma.readingProgress.count({
        where: {
          status: "completed",
        },
      }),
    ]);

    const paperStatusCounts = countByKey(
      paperStatusGroups.map((group) => ({
        key: group.status as PaperStatusValue,
        count: group._count._all,
      })),
    );
    const totalPapers = paperStatuses.reduce((total, status) => total + (paperStatusCounts.get(status) ?? 0), 0);

    const difficultyCounts = countByKey(
      difficultyGroups.map((group) => ({
        key: group.difficultyLevel as DifficultyLevelValue,
        count: group._count._all,
      })),
    );

    const categoryCounts = new Map<
      string,
      {
        categoryId: string;
        categoryName: string;
        totalPapers: number;
        publishedPapers: number;
        pendingPapers: number;
        needsReviewPapers: number;
        rejectedPapers: number;
        inactivePapers: number;
      }
    >(
      categories.map((category) => [
        category.id,
        {
          categoryId: category.id,
          categoryName: category.name,
          totalPapers: 0,
          publishedPapers: 0,
          pendingPapers: 0,
          needsReviewPapers: 0,
          rejectedPapers: 0,
          inactivePapers: 0,
        },
      ]),
    );

    for (const group of categoryStatusGroups) {
      const category = categoryCounts.get(group.categoryId);
      if (!category) {
        continue;
      }

      category.totalPapers += group._count._all;

      if (group.status === "published") {
        category.publishedPapers = group._count._all;
      } else if (group.status === "pending") {
        category.pendingPapers = group._count._all;
      } else if (group.status === "needs_review") {
        category.needsReviewPapers = group._count._all;
      } else if (group.status === "rejected") {
        category.rejectedPapers = group._count._all;
      } else if (group.status === "inactive") {
        category.inactivePapers = group._count._all;
      }
    }

    const ingestionStatusCounts = countByKey(
      ingestionStatusGroups.map((group) => ({
        key: group.status as IngestionStatusValue,
        count: group._count._all,
      })),
    );
    const totalIngestionRuns = ingestionStatuses.reduce(
      (total, status) => total + (ingestionStatusCounts.get(status) ?? 0),
      0,
    );

    return {
      paperStatusSummary: {
        totalPapers,
        publishedPapers: paperStatusCounts.get("published") ?? 0,
        pendingPapers: paperStatusCounts.get("pending") ?? 0,
        needsReviewPapers: paperStatusCounts.get("needs_review") ?? 0,
        rejectedPapers: paperStatusCounts.get("rejected") ?? 0,
        inactivePapers: paperStatusCounts.get("inactive") ?? 0,
      },
      classificationSummary: {
        classifiedPapers,
        unclassifiedPapers: Math.max(0, totalPapers - classifiedPapers),
        beginnerFriendly: difficultyCounts.get("beginner_friendly") ?? 0,
        moderate: difficultyCounts.get("moderate") ?? 0,
        difficult: difficultyCounts.get("difficult") ?? 0,
        expert: difficultyCounts.get("expert") ?? 0,
      },
      categoryDistribution: Array.from(categoryCounts.values()),
      difficultyDistribution: difficultyLevels.map((difficultyLevel) => ({
        difficultyLevel,
        count: difficultyCounts.get(difficultyLevel) ?? 0,
      })),
      ingestionOverview: {
        lastIngestionStatus: lastIngestion?.status ?? null,
        lastIngestionAt: toIsoDate(lastIngestion?.startedAt ?? null),
        totalIngestionRuns,
        successfulRuns: ingestionStatusCounts.get("success") ?? 0,
        failedRuns: ingestionStatusCounts.get("failed") ?? 0,
        partialRuns: ingestionStatusCounts.get("partial") ?? 0,
      },
      latestIngestionLogs: latestIngestionLogs.map((log) => ({
        id: log.id,
        provider: log.provider,
        status: log.status,
        totalFetched: log.totalFetched,
        totalSaved: log.totalSaved,
        totalRejected: log.totalRejected,
        errorMessage: log.errorMessage,
        startedAt: log.startedAt.toISOString(),
        finishedAt: toIsoDate(log.finishedAt),
      })),
      recentPapers: recentPapers.map((paper) => ({
        id: paper.id,
        title: paper.title,
        status: paper.status,
        category: paper.category,
        difficultyLevel: paper.classification?.difficultyLevel ?? null,
        beginnerScore: paper.classification?.beginnerScore ?? null,
        createdAt: paper.createdAt.toISOString(),
      })),
      engagementSnapshot: {
        totalReadingProgress,
        totalBookmarks,
        totalNotes,
        completedReadings,
      },
      systemHealth: {
        database: databaseHealth,
      },
    };
  }),
});
