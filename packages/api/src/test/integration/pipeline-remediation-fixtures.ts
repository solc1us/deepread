import { randomUUID } from "node:crypto";

import type { TestDatabaseClient } from "./test-fixtures";

export interface PipelineRemediationFixtures {
  runId: string;
  startedAt: Date;
  categoryId: string;
  admin: {
    id: string;
    name: string;
    email: string;
    role: "admin";
  };
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
}

export function buildClassifiableAbstract(label: string) {
  return Array.from(
    { length: 115 },
    (_, index) =>
      `${label.replaceAll(" ", "-")}-${index + 1}`,
  ).join(" ");
}

export function completeClassificationData(
  difficultyLevel: "beginner_friendly" | "moderate" | "difficult" | "expert" = "moderate",
) {
  return {
    difficultyLevel,
    beginnerScore: 72,
    estimatedReadingTime: 8,
    abstractLengthScore: 90,
    sentenceComplexityScore: 82,
    jargonDensityScore: 78,
    methodologyComplexityScore: 75,
    statisticalComplexityScore: 80,
    prerequisiteScore: 76,
    clarityScore: 84,
    classificationReason: "Complete isolated integration-test classification.",
    readingWarning: null,
    recommendedReader: "Readers with introductory background knowledge.",
    classificationVersion: "rule-based-v2.1.4",
  } as const;
}

export async function createPipelineRemediationFixtures(
  prisma: TestDatabaseClient,
  runId: string,
): Promise<PipelineRemediationFixtures> {
  const categoryId = randomUUID();
  const admin = {
    id: `${runId}_pipeline_admin`,
    name: "Pipeline Integration Admin",
    email: `${runId}.pipeline.admin@example.test`,
    role: "admin" as const,
  };
  const userA = {
    id: `${runId}_pipeline_user_a`,
    name: "Pipeline Integration User A",
    email: `${runId}.pipeline.a@example.test`,
    role: "user" as const,
  };
  const userB = {
    id: `${runId}_pipeline_user_b`,
    name: "Pipeline Integration User B",
    email: `${runId}.pipeline.b@example.test`,
    role: "user" as const,
  };

  await prisma.category.create({
    data: {
      id: categoryId,
      name: `${runId} category`,
      description: "Isolated pipeline and remediation integration fixture",
    },
  });
  await prisma.user.createMany({
    data: [admin, userA, userB].map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: true,
      role: user.role,
    })),
  });

  return {
    runId,
    startedAt: new Date(),
    categoryId,
    admin,
    userA,
    userB,
  };
}

export async function createPipelinePaper(
  prisma: TestDatabaseClient,
  fixtures: PipelineRemediationFixtures,
  label: string,
  options: {
    title?: string;
    abstract?: string;
    authors?: string[];
    publicationYear?: number | null;
    status?: "pending" | "needs_review" | "published" | "rejected" | "inactive";
    doi?: string | null;
    sourceUrl?: string;
    pdfUrl?: string | null;
    withClassification?: boolean;
    difficulty?: "beginner_friendly" | "moderate" | "difficult" | "expert";
  } = {},
) {
  return await prisma.paper.create({
    data: {
      id: randomUUID(),
      title: options.title ?? `${fixtures.runId} ${label}`,
      abstract: options.abstract ?? buildClassifiableAbstract(label),
      authors: options.authors ?? ["Integration Test Author"],
      publicationYear: options.publicationYear === undefined ? 2026 : options.publicationYear,
      doi: options.doi,
      sourceName: "Integration test",
      sourceUrl: options.sourceUrl ?? `https://example.test/${fixtures.runId}/${label}`,
      pdfUrl: options.pdfUrl,
      categoryId: fixtures.categoryId,
      status: options.status ?? "pending",
      ...(options.withClassification
        ? {
            classification: {
              create: completeClassificationData(options.difficulty),
            },
          }
        : {}),
    },
  });
}

export async function cleanupPipelineRemediationFixtures(
  prisma: TestDatabaseClient,
  fixtures: PipelineRemediationFixtures | null,
) {
  if (!fixtures) {
    return;
  }

  const papers = await prisma.paper.findMany({
    where: { title: { startsWith: `${fixtures.runId} ` } },
    select: { id: true },
  });
  const paperIds = papers.map((paper) => paper.id);
  const userIds = [fixtures.admin.id, fixtures.userA.id, fixtures.userB.id];
  const categories = await prisma.category.findMany({
    where: { name: { startsWith: fixtures.runId } },
    select: { id: true },
  });

  await prisma.$transaction([
    prisma.duplicateGroupResolution.deleteMany({ where: { resolvedById: fixtures.admin.id } }),
    prisma.adminPaperAuditLog.deleteMany({
      where: {
        OR: [{ adminUserId: fixtures.admin.id }, { paperId: { in: paperIds } }],
      },
    }),
    prisma.readingNote.deleteMany({ where: { paperId: { in: paperIds } } }),
    prisma.readingProgress.deleteMany({ where: { paperId: { in: paperIds } } }),
    prisma.bookmark.deleteMany({ where: { paperId: { in: paperIds } } }),
    prisma.paperClassification.deleteMany({ where: { paperId: { in: paperIds } } }),
    prisma.paperSource.deleteMany({ where: { paperId: { in: paperIds } } }),
    prisma.paper.deleteMany({ where: { id: { in: paperIds } } }),
    prisma.ingestionLog.deleteMany({ where: { createdAt: { gte: fixtures.startedAt } } }),
    prisma.category.deleteMany({ where: { id: { in: categories.map((category) => category.id) } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}
