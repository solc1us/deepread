import prisma from "@deepread/db";
import { z } from "zod";

import { adminProcedure, router } from "../../index";
import {
  OPENALEX_INGESTION_DEFAULT_LIMIT,
  OPENALEX_INGESTION_MAX_LIMIT,
  OPENALEX_INGESTION_MIN_LIMIT,
} from "../../openalex-ingestion-limits";
import { runOpenAlexIngestion } from "../../services/openalex-ingestion";

const ingestionLimitMessage =
  `Limit must be between ${OPENALEX_INGESTION_MIN_LIMIT} and ${OPENALEX_INGESTION_MAX_LIMIT}.`;

const adminIngestionInputSchema = z.object({
  categoryId: z.string().uuid(),
  query: z.string().trim().min(1, "Search query is required."),
  limit: z.coerce
    .number()
    .int({ message: ingestionLimitMessage })
    .min(OPENALEX_INGESTION_MIN_LIMIT, { message: ingestionLimitMessage })
    .max(OPENALEX_INGESTION_MAX_LIMIT, { message: ingestionLimitMessage })
    .default(OPENALEX_INGESTION_DEFAULT_LIMIT),
});

const ingestionLogsInputSchema = z
  .object({
    limit: z.number().int().min(1).max(100).default(20),
  })
  .optional();

const openAlexQueryPresets = [
  { label: "Educational technology", query: "educational technology", recommendedCategory: "Technology" },
  { label: "Machine learning", query: "machine learning", recommendedCategory: "Computer Science" },
  { label: "Student learning", query: "student learning", recommendedCategory: "Education" },
  { label: "Public health intervention", query: "public health intervention", recommendedCategory: "Health" },
  { label: "Business education", query: "business education", recommendedCategory: "Business" },
  { label: "Cognitive behavioral therapy", query: "cognitive behavioral therapy", recommendedCategory: "Psychology" },
  { label: "Social inequality", query: "social inequality", recommendedCategory: "Social Science" },
  { label: "Engineering education", query: "engineering education", recommendedCategory: "Engineering" },
] as const;

export const adminIngestionRouter = router({
  runOpenAlex: adminProcedure.input(adminIngestionInputSchema).mutation(async ({ input }) => {
    return await runOpenAlexIngestion(input);
  }),
  getQueryPresets: adminProcedure.query(() => ({
    presets: openAlexQueryPresets,
  })),
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
