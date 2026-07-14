import prisma from "@deepread/db";

import { protectedProcedure, router } from "../index";
import {
  ensurePublishedPaper,
  paperIdInputSchema,
  readingProgressSelect,
  updateReadingProgressInputSchema,
} from "./shared";

export const readingRouter = router({
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
    await ensurePublishedPaper(input.paperId);

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
});
