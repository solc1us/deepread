import { randomUUID } from "node:crypto";

import type { TestDatabaseClient } from "./test-fixtures";

const publishedPaperKeys = [
  "readingWorkflow",
  "readingIsolation",
  "bookmarkWorkflow",
  "notesWorkflow",
  "statsReading",
  "statsCompleted",
] as const;
const unpublishedStatuses = ["pending", "needs_review", "rejected", "inactive"] as const;

type PublishedPaperKey = (typeof publishedPaperKeys)[number];
type UnpublishedStatus = (typeof unpublishedStatuses)[number];

interface TestUser {
  id: string;
  name: string;
  email: string;
  role: "user";
}

export interface ReadingWorkflowFixtures {
  runId: string;
  categoryId: string;
  userA: TestUser;
  userB: TestUser;
  publishedPaperIds: Record<PublishedPaperKey, string>;
  unpublishedPaperIds: Record<UnpublishedStatus, string>;
  stats: {
    readingProgressId: string;
    completedProgressId: string;
    bookmarkId: string;
    noteId: string;
  };
}

export async function createReadingWorkflowFixtures(
  prisma: TestDatabaseClient,
  runId: string,
): Promise<ReadingWorkflowFixtures> {
  const categoryId = randomUUID();
  const publishedPaperIds = Object.fromEntries(
    publishedPaperKeys.map((key) => [key, randomUUID()]),
  ) as Record<PublishedPaperKey, string>;
  const unpublishedPaperIds = Object.fromEntries(
    unpublishedStatuses.map((status) => [status, randomUUID()]),
  ) as Record<UnpublishedStatus, string>;
  const userA: TestUser = {
    id: `${runId}_reading_user_a`,
    name: "Reading Integration User A",
    email: `${runId}.reading.a@example.test`,
    role: "user",
  };
  const userB: TestUser = {
    id: `${runId}_reading_user_b`,
    name: "Reading Integration User B",
    email: `${runId}.reading.b@example.test`,
    role: "user",
  };

  await prisma.category.create({
    data: {
      id: categoryId,
      name: `${runId} category`,
      description: "Isolated reading-workflow integration fixture",
    },
  });

  await prisma.user.createMany({
    data: [userA, userB].map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      role: user.role,
    })),
  });

  await prisma.paper.createMany({
    data: [
      ...publishedPaperKeys.map((key) => ({
        id: publishedPaperIds[key],
        title: `${runId} ${key} published paper`,
        abstract: `Published integration fixture for ${key}.`,
        authors: ["Reading Integration Author"],
        publicationYear: 2026,
        sourceName: "Reading integration test",
        sourceUrl: `https://example.test/${runId}/${key}`,
        categoryId,
        status: "published" as const,
      })),
      ...unpublishedStatuses.map((status) => ({
        id: unpublishedPaperIds[status],
        title: `${runId} ${status} paper`,
        abstract: `Unpublished integration fixture with ${status} status.`,
        authors: ["Reading Integration Author"],
        publicationYear: 2026,
        sourceName: "Reading integration test",
        sourceUrl: `https://example.test/${runId}/${status}`,
        categoryId,
        status,
      })),
    ],
  });

  const classificationByPaper: Array<{
    paperId: string;
    difficultyLevel: "beginner_friendly" | "moderate" | "difficult" | "expert";
    beginnerScore: number;
    estimatedReadingTime: number;
  }> = [
    {
      paperId: publishedPaperIds.readingWorkflow,
      difficultyLevel: "moderate",
      beginnerScore: 75,
      estimatedReadingTime: 12,
    },
    {
      paperId: publishedPaperIds.readingIsolation,
      difficultyLevel: "moderate",
      beginnerScore: 72,
      estimatedReadingTime: 14,
    },
    {
      paperId: publishedPaperIds.bookmarkWorkflow,
      difficultyLevel: "expert",
      beginnerScore: 35,
      estimatedReadingTime: 30,
    },
    {
      paperId: publishedPaperIds.notesWorkflow,
      difficultyLevel: "moderate",
      beginnerScore: 70,
      estimatedReadingTime: 16,
    },
    {
      paperId: publishedPaperIds.statsReading,
      difficultyLevel: "beginner_friendly",
      beginnerScore: 90,
      estimatedReadingTime: 8,
    },
    {
      paperId: publishedPaperIds.statsCompleted,
      difficultyLevel: "difficult",
      beginnerScore: 52,
      estimatedReadingTime: 25,
    },
  ];

  await prisma.paperClassification.createMany({
    data: classificationByPaper.map((classification) => ({
      ...classification,
      classificationReason: "Complete deterministic reading integration classification.",
      classificationVersion: "rule-based-v2.1.4",
    })),
  });

  const now = Date.now();
  const [readingProgress, completedProgress, bookmark, note] = await Promise.all([
    prisma.readingProgress.create({
      data: {
        userId: userB.id,
        paperId: publishedPaperIds.statsReading,
        status: "reading",
        progressPercentage: 40,
        startedAt: new Date(now - 60 * 60 * 1000),
        lastReadAt: new Date(now - 30 * 60 * 1000),
      },
      select: { id: true },
    }),
    prisma.readingProgress.create({
      data: {
        userId: userB.id,
        paperId: publishedPaperIds.statsCompleted,
        status: "completed",
        progressPercentage: 100,
        startedAt: new Date(now - 3 * 60 * 60 * 1000),
        completedAt: new Date(now - 2 * 60 * 60 * 1000),
        lastReadAt: new Date(now - 2 * 60 * 60 * 1000),
      },
      select: { id: true },
    }),
    prisma.bookmark.create({
      data: {
        userId: userB.id,
        paperId: publishedPaperIds.statsCompleted,
      },
      select: { id: true },
    }),
    prisma.readingNote.create({
      data: {
        userId: userB.id,
        paperId: publishedPaperIds.statsReading,
        note: "Deterministic statistics fixture note",
        section: "Statistics fixture",
      },
      select: { id: true },
    }),
  ]);

  return {
    runId,
    categoryId,
    userA,
    userB,
    publishedPaperIds,
    unpublishedPaperIds,
    stats: {
      readingProgressId: readingProgress.id,
      completedProgressId: completedProgress.id,
      bookmarkId: bookmark.id,
      noteId: note.id,
    },
  };
}

export async function cleanupReadingWorkflowFixtures(
  prisma: TestDatabaseClient,
  fixtures: ReadingWorkflowFixtures | null,
) {
  if (!fixtures) {
    return;
  }

  const paperIds = [...Object.values(fixtures.publishedPaperIds), ...Object.values(fixtures.unpublishedPaperIds)];
  const userIds = [fixtures.userA.id, fixtures.userB.id];

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

  const [remainingPapers, remainingUsers, remainingCategories] = await Promise.all([
    prisma.paper.count({ where: { id: { in: paperIds } } }),
    prisma.user.count({ where: { id: { in: userIds } } }),
    prisma.category.count({ where: { id: fixtures.categoryId } }),
  ]);
  if (remainingPapers + remainingUsers + remainingCategories !== 0) {
    throw new Error("Reading integration fixture cleanup did not complete.");
  }
}
