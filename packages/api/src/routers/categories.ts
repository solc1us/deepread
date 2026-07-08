import prisma from "@deepread/db";

import { publicProcedure, router } from "../index";

export const categoriesRouter = router({
  list: publicProcedure.query(async () => {
    const categories = await prisma.category.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: {
            papers: true,
          },
        },
      },
    });

    return categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      paperCount: category._count.papers,
    }));
  }),
});
