import { env } from "@deepread/env/server";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

// Temporary Phase 3 guard. Replace with role-based admin auth once admin sessions exist.
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!env.ADMIN_INGESTION_SECRET || ctx.adminSecret !== env.ADMIN_INGESTION_SECRET) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Invalid admin ingestion secret",
    });
  }

  return next({
    ctx,
  });
});

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
