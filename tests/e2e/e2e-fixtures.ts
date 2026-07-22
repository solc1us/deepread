import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createTestDatabaseClient } from "../../packages/db/src/test-database-client";
import { hashTestCredentialPassword } from "../../packages/db/src/test-credential";
import { getE2EEnvironment } from "./e2e-environment";
import type { E2EState } from "./e2e-state";

const E2E_TITLE_PREFIX = "E2E ";
const E2E_CATEGORY_PREFIX = "E2E ";
const E2E_EMAIL_PREFIX = "e2e-";
const E2E_EMAIL_SUFFIX = "@deepread.test";
const MODULE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.resolve(MODULE_DIRECTORY, "../../tmp/deepread-e2e-state.json");

const LONG_ABSTRACT = [
  "This study presents a clear educational analysis of academic reading practices for university students.",
  "The paper describes the sample, method, and findings using accessible language and a focused research question.",
  "Results show how structured reading routines can support comprehension, reflection, and consistent study progress.",
  "The discussion explains practical implications while avoiding unnecessary technical terminology and unsupported claims.",
  "These findings provide a useful basis for readers who are beginning to evaluate scholarly literature independently.",
].join(" ");

export async function readE2EState() {
  return JSON.parse(await readFile(STATE_PATH, "utf8")) as E2EState;
}

export async function removeE2EStateFile() {
  await unlink(STATE_PATH).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

async function cleanupOwnedFixtures(prisma: ReturnType<typeof createTestDatabaseClient>) {
  const [users, papers] = await Promise.all([
    prisma.user.findMany({
      where: {
        email: { startsWith: E2E_EMAIL_PREFIX, endsWith: E2E_EMAIL_SUFFIX },
      },
      select: { id: true },
    }),
    prisma.paper.findMany({
      where: { title: { startsWith: E2E_TITLE_PREFIX } },
      select: { id: true },
    }),
  ]);
  const userIds = users.map((user) => user.id);
  const paperIds = papers.map((paper) => paper.id);

  if (userIds.length > 0) {
    await prisma.duplicateGroupResolution.deleteMany({
      where: { resolvedById: { in: userIds } },
    });
  }
  if (paperIds.length > 0 || userIds.length > 0) {
    await prisma.adminPaperAuditLog.deleteMany({
      where: {
        OR: [
          ...(paperIds.length > 0 ? [{ paperId: { in: paperIds } }] : []),
          ...(userIds.length > 0 ? [{ adminUserId: { in: userIds } }] : []),
        ],
      },
    });
  }
  if (paperIds.length > 0) {
    await prisma.paper.deleteMany({ where: { id: { in: paperIds } } });
  }
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.category.deleteMany({
    where: { name: { startsWith: E2E_CATEGORY_PREFIX } },
  });
}

async function createCredentialUser(
  prisma: ReturnType<typeof createTestDatabaseClient>,
  input: { email: string; name: string; passwordHash: string; role: "user" | "admin" },
) {
  const id = randomUUID();
  await prisma.user.create({
    data: {
      id,
      email: input.email,
      emailVerified: true,
      name: input.name,
      role: input.role,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: input.passwordHash,
        },
      },
    },
  });
  return id;
}

function classification(difficulty: "moderate" | "expert", beginnerScore: number) {
  return {
    difficultyLevel: difficulty,
    beginnerScore,
    estimatedReadingTime: 8,
    abstractLengthScore: 90,
    sentenceComplexityScore: 88,
    jargonDensityScore: 86,
    methodologyComplexityScore: 82,
    statisticalComplexityScore: 90,
    prerequisiteScore: 88,
    clarityScore: 92,
    classificationReason: "E2E fixture classification for local browser testing.",
    readingWarning: null,
    recommendedReader: "University students",
    classificationVersion: "rule-based-v2.1.4",
  } as const;
}

export async function createE2EFixtures() {
  const environment = getE2EEnvironment();
  const prisma = createTestDatabaseClient(environment.database.databaseUrl);
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const password = "DeepReadE2E!2026";

  try {
    await cleanupOwnedFixtures(prisma);
    const passwordHash = await hashTestCredentialPassword(password);
    const user = {
      id: await createCredentialUser(prisma, {
        email: `e2e-user-${runId}${E2E_EMAIL_SUFFIX}`,
        name: `E2E Reader ${runId}`,
        passwordHash,
        role: "user",
      }),
      email: `e2e-user-${runId}${E2E_EMAIL_SUFFIX}`,
      name: `E2E Reader ${runId}`,
    };
    const admin = {
      id: await createCredentialUser(prisma, {
        email: `e2e-admin-${runId}${E2E_EMAIL_SUFFIX}`,
        name: `E2E Admin ${runId}`,
        passwordHash,
        role: "admin",
      }),
      email: `e2e-admin-${runId}${E2E_EMAIL_SUFFIX}`,
      name: `E2E Admin ${runId}`,
    };
    const category = await prisma.category.create({
      data: { name: `E2E Learning ${runId}`, description: "Local E2E fixture category" },
    });
    const secondaryCategory = await prisma.category.create({
      data: { name: `E2E Systems ${runId}`, description: "Local E2E fixture category" },
    });

    const publishedPapers = [];
    for (let index = 1; index <= 12; index += 1) {
      const title = `E2E ${runId} Accessible Research ${String(index).padStart(2, "0")}`;
      const paper = await prisma.paper.create({
        data: {
          title,
          abstract: LONG_ABSTRACT,
          authors: ["Alex Reader", "Morgan Scholar"],
          publicationYear: 2024,
          sourceName: "E2E source",
          sourceUrl: `http://127.0.0.1:3001/e2e-source/${runId}/${index}`,
          categoryId: category.id,
          status: "published",
          language: "en",
          classification: { create: classification("moderate", 76) },
          sources: {
            create: {
              provider: "e2e",
              externalId: `${runId}-published-${index}`,
              rawMetadata: { fixture: true },
            },
          },
        },
      });
      publishedPapers.push({ id: paper.id, title });
    }

    await prisma.paper.create({
      data: {
        title: `E2E ${runId} Advanced Systems Paper`,
        abstract: LONG_ABSTRACT,
        authors: ["Taylor Engineer"],
        publicationYear: 2023,
        sourceName: "E2E source",
        sourceUrl: `http://127.0.0.1:3001/e2e-source/${runId}/advanced`,
        categoryId: secondaryCategory.id,
        status: "published",
        language: "en",
        classification: { create: classification("expert", 35) },
      },
    });

    const unpublishedPaper = await prisma.paper.create({
      data: {
        title: `E2E ${runId} Unpublished Paper`,
        abstract: LONG_ABSTRACT,
        authors: ["Hidden Author"],
        publicationYear: 2024,
        sourceName: "E2E source",
        sourceUrl: `http://127.0.0.1:3001/e2e-source/${runId}/unpublished`,
        categoryId: category.id,
        status: "pending",
      },
    });

    const needsReviewPaper = await prisma.paper.create({
      data: {
        title: `E2E ${runId} Needs Review Paper`,
        abstract: "This concise abstract is intentionally too short for automatic publication.",
        authors: ["Review Author"],
        publicationYear: 2024,
        sourceName: "E2E source",
        sourceUrl: `http://127.0.0.1:3001/e2e-source/${runId}/review`,
        categoryId: category.id,
        status: "needs_review",
        sources: {
          create: {
            provider: "openalex",
            externalId: `W${Date.now()}01`,
            rawMetadata: { fixture: true },
          },
        },
      },
    });

    const duplicateTitle = `E2E ${runId} Duplicate Candidate`;
    for (let index = 1; index <= 2; index += 1) {
      await prisma.paper.create({
        data: {
          title: duplicateTitle,
          abstract: LONG_ABSTRACT,
          authors: [`Duplicate Author ${index}`],
          publicationYear: 2022 + index,
          sourceName: "E2E source",
          sourceUrl: `http://127.0.0.1:3001/e2e-source/${runId}/duplicate-${index}`,
          categoryId: secondaryCategory.id,
          status: "published",
          classification: { create: classification("moderate", 72) },
          sources: {
            create: {
              provider: "e2e",
              externalId: `${runId}-duplicate-${index}`,
              rawMetadata: { fixture: true },
            },
          },
        },
      });
    }

    await Promise.all([
      prisma.bookmark.create({
        data: { userId: user.id, paperId: publishedPapers[1]!.id },
      }),
      prisma.readingProgress.create({
        data: {
          userId: user.id,
          paperId: publishedPapers[1]!.id,
          status: "completed",
          progressPercentage: 100,
          startedAt: new Date(Date.now() - 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 30 * 60 * 1000),
          lastReadAt: new Date(Date.now() - 30 * 60 * 1000),
        },
      }),
    ]);

    const state: E2EState = {
      runId,
      password,
      user,
      admin,
      category: { id: category.id, name: category.name },
      secondaryCategory: { id: secondaryCategory.id, name: secondaryCategory.name },
      publishedPaperIds: publishedPapers.map((paper) => paper.id),
      primaryPaper: publishedPapers[0]!,
      unpublishedPaper: { id: unpublishedPaper.id, title: unpublishedPaper.title },
      needsReviewPaper: { id: needsReviewPaper.id, title: needsReviewPaper.title },
      duplicateTitle,
    };
    await mkdir(path.dirname(STATE_PATH), { recursive: true });
    await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    return state;
  } finally {
    await prisma.$disconnect();
  }
}

export async function cleanupE2EFixtures() {
  const environment = getE2EEnvironment();
  const prisma = createTestDatabaseClient(environment.database.databaseUrl);
  try {
    await cleanupOwnedFixtures(prisma);
  } finally {
    await prisma.$disconnect();
    await removeE2EStateFile();
  }
}
