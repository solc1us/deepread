import prisma from "@deepread/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, router } from "../../index";
import { difficultyLevelSchema } from "../shared";

const paperStatusSchema = z.enum(["pending", "needs_review", "published", "rejected", "inactive"]);
const paperIdInputSchema = z.object({
  paperId: z.string().uuid(),
});

const adminPaperListInputSchema = z.object({
  status: paperStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  difficulty: difficultyLevelSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

const statusChangePaperSelect = {
  id: true,
  status: true,
  classification: {
    select: {
      difficultyLevel: true,
      beginnerScore: true,
      classificationVersion: true,
    },
  },
} as const;

function hasValidClassification(
  classification: {
    difficultyLevel: string;
    beginnerScore: number;
    classificationVersion: string;
  } | null,
) {
  return Boolean(
    classification &&
      classification.difficultyLevel &&
      Number.isInteger(classification.beginnerScore) &&
      classification.beginnerScore >= 0 &&
      classification.beginnerScore <= 100 &&
      classification.classificationVersion.trim(),
  );
}

async function getPaperForStatusChange(paperId: string) {
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    select: statusChangePaperSelect,
  });

  if (!paper) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Paper not found",
    });
  }

  return paper;
}

export const adminPapersRouter = router({
  list: adminProcedure.input(adminPaperListInputSchema).query(async ({ input }) => {
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
      ...(input.difficulty
        ? {
            classification: {
              difficultyLevel: input.difficulty,
            },
          }
        : {}),
    };

    const [papers, total] = await Promise.all([
      prisma.paper.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
        select: {
          id: true,
          title: true,
          status: true,
          createdAt: true,
          updatedAt: true,
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
              classificationVersion: true,
            },
          },
        },
      }),
      prisma.paper.count({ where }),
    ]);

    return {
      papers: papers.map((paper) => ({
        id: paper.id,
        title: paper.title,
        status: paper.status,
        createdAt: paper.createdAt.toISOString(),
        updatedAt: paper.updatedAt.toISOString(),
        category: paper.category,
        classification: paper.classification
          ? {
              difficultyLevel: paper.classification.difficultyLevel,
              beginnerScore: paper.classification.beginnerScore,
            }
          : null,
        hasValidClassification: hasValidClassification(paper.classification),
        difficultyLevel: paper.classification?.difficultyLevel ?? null,
        beginnerScore: paper.classification?.beginnerScore ?? null,
      })),
      pagination: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }),
  deactivate: adminProcedure.input(paperIdInputSchema).mutation(async ({ input }) => {
    const paper = await getPaperForStatusChange(input.paperId);

    if (paper.status !== "published" && paper.status !== "needs_review") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only published or needs-review papers can be deactivated",
      });
    }

    return await prisma.paper.update({
      where: { id: paper.id },
      data: { status: "inactive" },
      select: {
        id: true,
        status: true,
      },
    });
  }),
  reactivate: adminProcedure.input(paperIdInputSchema).mutation(async ({ input }) => {
    const paper = await getPaperForStatusChange(input.paperId);

    if (paper.status !== "inactive") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only inactive papers can be reactivated",
      });
    }

    return await prisma.paper.update({
      where: { id: paper.id },
      data: {
        status: hasValidClassification(paper.classification) ? "published" : "needs_review",
      },
      select: {
        id: true,
        status: true,
      },
    });
  }),
  publish: adminProcedure.input(paperIdInputSchema).mutation(async ({ input }) => {
    const paper = await getPaperForStatusChange(input.paperId);

    if (!hasValidClassification(paper.classification)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "A valid classification is required before publication",
      });
    }

    return await prisma.paper.update({
      where: { id: paper.id },
      data: { status: "published" },
      select: {
        id: true,
        status: true,
      },
    });
  }),
});
