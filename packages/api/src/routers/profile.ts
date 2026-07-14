import prisma from "@deepread/db";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, router } from "../index";
import { profilePaperSelect } from "./shared";

export const profileRouter = router({
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
          paper: {
            status: "published",
          },
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
});
