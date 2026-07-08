import prisma from "@deepread/db";
import { z } from "zod";

import { adminProcedure, router } from "../../index";
import { runOpenAlexIngestion } from "../../services/openalex-ingestion";

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

export const adminIngestionRouter = router({
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
});
