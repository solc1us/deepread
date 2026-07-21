import prisma from "@deepread/db";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error, ctx }) {
    const isUnexpectedInternalError =
      error.code === "INTERNAL_SERVER_ERROR" && error.cause instanceof Error;

    return {
      ...shape,
      message: isUnexpectedInternalError ? "Internal server error." : shape.message,
      data: {
        ...shape.data,
        stack: undefined,
        requestId: ctx?.requestId ?? null,
      },
    };
  },
});

export const router = t.router;

export const publicProcedure = t.procedure;

export const requireAdmin = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }

  const user = await prisma.user.findUnique({
    where: {
      id: ctx.session.user.id,
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user || user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }

  return next({
    ctx: {
      ...ctx,
      adminUser: user,
    },
  });
});

export const adminProcedure = t.procedure.use(requireAdmin);

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});
