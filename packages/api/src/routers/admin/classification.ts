import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, router } from "../../index";
import {
  classifyPaperById,
  classifyPendingPapers,
  PaperClassificationServiceError,
} from "../../services/paper-classification";
import { classifyPaperDifficulty } from "../../services/paper-difficulty-classifier";

const adminClassificationRunForPaperInputSchema = z.object({
  paperId: z.string().uuid(),
});

const adminClassificationRunBatchInputSchema = z
  .object({
    limit: z.number().int().min(1).max(50).default(10),
    categoryId: z.string().uuid().optional(),
  })
  .optional();

const adminClassificationPreviewInputSchema = z.object({
  title: z.string().trim().min(1),
  abstract: z.string().trim().min(1),
  keywords: z.array(z.string().trim().min(1)).default([]),
  categoryName: z.string().trim().min(1).optional(),
  publicationYear: z.number().int().min(1900).max(2100).nullable().optional(),
});

export const adminClassificationRouter = router({
  runForPaper: adminProcedure.input(adminClassificationRunForPaperInputSchema).mutation(async ({ input }) => {
    try {
      return await classifyPaperById(input.paperId);
    } catch (error) {
      if (error instanceof PaperClassificationServiceError && error.code === "PAPER_NOT_FOUND") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Paper not found",
        });
      }

      if (error instanceof PaperClassificationServiceError && error.code === "PAPER_INACTIVE") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error.message,
        });
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to classify paper",
      });
    }
  }),
  runBatch: adminProcedure.input(adminClassificationRunBatchInputSchema).mutation(async ({ input }) => {
    return await classifyPendingPapers(input ?? {});
  }),
  preview: adminProcedure.input(adminClassificationPreviewInputSchema).mutation(({ input }) => {
    return classifyPaperDifficulty(input);
  }),
});
