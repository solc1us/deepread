import { randomUUID } from "node:crypto";

import { createTestDatabaseClient } from "@deepread/db/test-database-client";

export type TestDatabaseClient = ReturnType<typeof createTestDatabaseClient>;

const paperStatuses = ["published", "pending", "needs_review", "rejected", "inactive"] as const;

export interface AccessControlFixtures {
  runId: string;
  categoryId: string;
  paperIds: Record<(typeof paperStatuses)[number], string>;
  userA: {
    id: string;
    name: string;
    email: string;
    role: "user";
  };
  userB: {
    id: string;
    name: string;
    email: string;
    role: "user";
  };
  admin: {
    id: string;
    name: string;
    email: string;
    role: "admin";
  };
  bookmarkId: string;
  noteId: string;
  progressId: string;
}

export function createTestRunId() {
  return `it_${Date.now()}_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

export async function createAccessControlFixtures(
  prisma: TestDatabaseClient,
  runId: string,
): Promise<AccessControlFixtures> {
  const categoryId = randomUUID();
  const paperIds = Object.fromEntries(paperStatuses.map((status) => [status, randomUUID()])) as Record<
    (typeof paperStatuses)[number],
    string
  >;
  const userA = {
    id: `${runId}_user_a`,
    name: "Integration User A",
    email: `${runId}.a@example.test`,
    role: "user" as const,
  };
  const userB = {
    id: `${runId}_user_b`,
    name: "Integration User B",
    email: `${runId}.b@example.test`,
    role: "user" as const,
  };
  const admin = {
    id: `${runId}_admin`,
    name: "Integration Admin",
    email: `${runId}.admin@example.test`,
    role: "admin" as const,
  };

  await prisma.category.create({
    data: {
      id: categoryId,
      name: `${runId} category`,
      description: "Isolated access-control integration fixture",
    },
  });

  await prisma.user.createMany({
    data: [userA, userB, admin].map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      role: user.role,
    })),
  });

  await prisma.paper.createMany({
    data: paperStatuses.map((status) => ({
      id: paperIds[status],
      title: `${runId} ${status} paper`,
      abstract: `Isolated ${status} paper used only for access-control integration testing.`,
      authors: ["Integration Test Author"],
      publicationYear: 2026,
      sourceName: "Integration test",
      sourceUrl: `https://example.test/${runId}/${status}`,
      categoryId,
      status,
    })),
  });

  await prisma.paperClassification.create({
    data: {
      paperId: paperIds.published,
      difficultyLevel: "moderate",
      beginnerScore: 75,
      estimatedReadingTime: 10,
      classificationReason: "Complete isolated test classification.",
      classificationVersion: "rule-based-v2.1.4",
    },
  });

  const [bookmark, note, progress] = await Promise.all([
    prisma.bookmark.create({
      data: {
        userId: userA.id,
        paperId: paperIds.published,
      },
      select: { id: true },
    }),
    prisma.readingNote.create({
      data: {
        userId: userA.id,
        paperId: paperIds.published,
        note: "Integration fixture note",
      },
      select: { id: true },
    }),
    prisma.readingProgress.create({
      data: {
        userId: userA.id,
        paperId: paperIds.published,
        status: "reading",
        progressPercentage: 40,
        startedAt: new Date(),
        lastReadAt: new Date(),
      },
      select: { id: true },
    }),
  ]);

  return {
    runId,
    categoryId,
    paperIds,
    userA,
    userB,
    admin,
    bookmarkId: bookmark.id,
    noteId: note.id,
    progressId: progress.id,
  };
}

export async function cleanupAccessControlFixtures(
  prisma: TestDatabaseClient,
  fixtures: AccessControlFixtures | null,
) {
  if (!fixtures) {
    return;
  }

  const paperIds = Object.values(fixtures.paperIds);
  const userIds = [fixtures.userA.id, fixtures.userB.id, fixtures.admin.id];

  await prisma.$transaction([
    prisma.readingNote.deleteMany({ where: { userId: { in: userIds }, paperId: { in: paperIds } } }),
    prisma.readingProgress.deleteMany({ where: { userId: { in: userIds }, paperId: { in: paperIds } } }),
    prisma.bookmark.deleteMany({ where: { userId: { in: userIds }, paperId: { in: paperIds } } }),
    prisma.paperClassification.deleteMany({ where: { paperId: { in: paperIds } } }),
    prisma.paperSource.deleteMany({ where: { paperId: { in: paperIds } } }),
    prisma.paper.deleteMany({ where: { id: { in: paperIds } } }),
    prisma.category.deleteMany({ where: { id: fixtures.categoryId } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

export async function cleanupCurrentTestRun(prisma: TestDatabaseClient, runId: string) {
  const [papers, users, categories] = await Promise.all([
    prisma.paper.findMany({
      where: { title: { startsWith: `${runId} ` } },
      select: { id: true },
    }),
    prisma.user.findMany({
      where: { id: { startsWith: `${runId}_` } },
      select: { id: true },
    }),
    prisma.category.findMany({
      where: { name: `${runId} category` },
      select: { id: true },
    }),
  ]);
  const paperIds = papers.map((paper) => paper.id);
  const userIds = users.map((user) => user.id);
  const categoryIds = categories.map((category) => category.id);

  await prisma.$transaction([
    prisma.readingNote.deleteMany({ where: { userId: { in: userIds }, paperId: { in: paperIds } } }),
    prisma.readingProgress.deleteMany({ where: { userId: { in: userIds }, paperId: { in: paperIds } } }),
    prisma.bookmark.deleteMany({ where: { userId: { in: userIds }, paperId: { in: paperIds } } }),
    prisma.paperClassification.deleteMany({ where: { paperId: { in: paperIds } } }),
    prisma.paperSource.deleteMany({ where: { paperId: { in: paperIds } } }),
    prisma.paper.deleteMany({ where: { id: { in: paperIds } } }),
    prisma.category.deleteMany({ where: { id: { in: categoryIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}
