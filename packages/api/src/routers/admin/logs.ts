import prisma from "@deepread/db";
import { z } from "zod";

import { adminProcedure, router } from "../../index";

const ingestionStatusSchema = z.enum(["success", "failed", "partial"]);

const adminLogListInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
  status: ingestionStatusSchema.optional(),
  provider: z.string().trim().min(1).max(100).optional(),
});

export const adminLogsRouter = router({
  list: adminProcedure.input(adminLogListInputSchema).query(async ({ input }) => {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.provider ? { provider: input.provider } : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.ingestionLog.findMany({
        where,
        orderBy: {
          startedAt: "desc",
        },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
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
      prisma.ingestionLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        provider: log.provider,
        status: log.status,
        totalFetched: log.totalFetched,
        totalSaved: log.totalSaved,
        totalRejected: log.totalRejected,
        errorMessage: log.errorMessage,
        startedAt: log.startedAt.toISOString(),
        finishedAt: log.finishedAt?.toISOString() ?? null,
      })),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }),
});
