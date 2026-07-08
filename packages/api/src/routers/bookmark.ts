import prisma from "@deepread/db";

import { protectedProcedure, router } from "../index";
import { bookmarkSelect, ensurePublishedPaper, mapBookmark, paperIdInputSchema } from "./shared";

export const bookmarkRouter = router({
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
});
