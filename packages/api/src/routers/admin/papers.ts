import prisma from "@deepread/db";
import { z } from "zod";

import { adminProcedure, router } from "../../index";
import { difficultyLevelSchema } from "../shared";

const paperStatusSchema = z.enum(["pending", "published", "rejected"]);

const adminPaperListInputSchema = z.object({
  status: paperStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  difficulty: difficultyLevelSchema.optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

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
});
