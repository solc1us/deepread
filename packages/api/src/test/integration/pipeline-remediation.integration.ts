import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";

import { loadTestDatabaseEnvironment } from "@deepread/db/test-database-environment";
import { createTestDatabaseClient } from "@deepread/db/test-database-client";

import { CLASSIFICATION_BATCH_MAX_LIMIT } from "../../classification-batch-limits";
import {
  OPENALEX_INGESTION_CONCURRENCY,
  OPENALEX_INGESTION_MAX_LIMIT,
  OPENALEX_REQUEST_MAX_LIMIT,
} from "../../openalex-ingestion-limits";
import {
  resolveDuplicateGroupWithRollbackProbeForTest,
} from "../../services/duplicate-paper-resolution";
import {
  runOpenAlexIngestionForTest,
} from "../../services/openalex-ingestion";
import type { OpenAlexWork } from "../../services/openalex";
import {
  CLASSIFICATION_BATCH_CONCURRENCY,
  CLASSIFICATION_VERSION,
  classifyPendingPapersForTest,
} from "../../services/paper-classification";
import { MANUAL_CLASSIFICATION_VERSION } from "../../services/paper-classification-validity";
import type { AppRouter } from "../../routers";
import {
  buildClassifiableAbstract,
  cleanupPipelineRemediationFixtures,
  createPipelinePaper,
  createPipelineRemediationFixtures,
  type PipelineRemediationFixtures,
} from "./pipeline-remediation-fixtures";
import { expectTrpcError } from "./test-assertions";
import { createUserContext } from "./test-context";
import { cleanupCurrentTestRun, createTestRunId } from "./test-fixtures";

type Caller = ReturnType<AppRouter["createCaller"]>;

setDefaultTimeout(60_000);

const environment = loadTestDatabaseEnvironment();
const fixturePrisma = createTestDatabaseClient(environment.databaseUrl);

let fixtures: PipelineRemediationFixtures | null = null;
let admin: Caller;
let normalUser: Caller;
let appPrisma: typeof import("@deepread/db").default;
let workSequence = 0;

function abstractIndex(label: string) {
  return Object.fromEntries(
    Array.from({ length: 70 }, (_, index) => [`${label}-${index}`, [index]]),
  );
}

function openAlexWork(
  label: string,
  overrides: Partial<OpenAlexWork> = {},
): OpenAlexWork {
  workSequence += 1;
  const id = `W${Date.now()}${String(workSequence).padStart(4, "0")}`;

  return {
    id: `https://openalex.org/${id}`,
    doi: `https://doi.org/10.5555/${fixtures!.runId}.${label}.${workSequence}`,
    display_name: `${fixtures!.runId} ${label} ${workSequence}`,
    publication_year: 2026,
    abstract_inverted_index: abstractIndex(label),
    authorships: [{ author: { display_name: "OpenAlex Integration Author" } }],
    primary_location: {
      landing_page_url: `https://example.test/openalex/${id}`,
      source: { display_name: "Integration Journal" },
    },
    topics: [{ display_name: "Integration testing" }],
    test_private_metadata: "must-not-be-returned",
    ...overrides,
  };
}

function mockOpenAlexPages(pages: OpenAlexWork[][], requests: URL[]) {
  return (async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    requests.push(url);
    const page = Number(url.searchParams.get("page") ?? "1");
    return new Response(JSON.stringify({ results: pages[page - 1] ?? [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

async function createCategory(label: string) {
  return await fixturePrisma.category.create({
    data: {
      id: randomUUID(),
      name: `${fixtures!.runId} ${label}`,
    },
  });
}

async function duplicateGroups() {
  const details = await admin.admin.dataQuality.getDetails({ issue: "duplicate-title" });
  return (details as { groups: Array<{ groupKey: string; papers: Array<{ paperId: string }> }> }).groups;
}

beforeAll(async () => {
  const runId = createTestRunId();

  try {
    fixtures = await createPipelineRemediationFixtures(fixturePrisma, runId);
  } catch (error) {
    await cleanupCurrentTestRun(fixturePrisma, runId).catch(() => undefined);
    const errorType = error instanceof Error ? error.name : typeof error;
    throw new Error(
      `Unable to create isolated pipeline fixtures (${errorType}). Apply migrations with bun run test:integration:migrate and verify the test database configuration.`,
    );
  }

  const [{ appRouter }, dbModule] = await Promise.all([import("../../routers"), import("@deepread/db")]);
  appPrisma = dbModule.default;
  admin = appRouter.createCaller(createUserContext(fixtures.admin));
  normalUser = appRouter.createCaller(createUserContext(fixtures.userA));
});

afterAll(async () => {
  try {
    await cleanupPipelineRemediationFixtures(fixturePrisma, fixtures);
    if (fixtures) {
      const [users, categories, papers, resolutions, audits, ingestionLogs] = await Promise.all([
        fixturePrisma.user.count({
          where: { id: { in: [fixtures.admin.id, fixtures.userA.id, fixtures.userB.id] } },
        }),
        fixturePrisma.category.count({ where: { name: { startsWith: fixtures.runId } } }),
        fixturePrisma.paper.count({ where: { title: { startsWith: `${fixtures.runId} ` } } }),
        fixturePrisma.duplicateGroupResolution.count({ where: { resolvedById: fixtures.admin.id } }),
        fixturePrisma.adminPaperAuditLog.count({ where: { adminUserId: fixtures.admin.id } }),
        fixturePrisma.ingestionLog.count({ where: { createdAt: { gte: fixtures.startedAt } } }),
      ]);

      if ([users, categories, papers, resolutions, audits, ingestionLogs].some((count) => count !== 0)) {
        throw new Error("Pipeline integration fixture cleanup left test-owned records behind.");
      }
    }
  } finally {
    await Promise.all([fixturePrisma.$disconnect(), appPrisma?.$disconnect()]);
  }
});

describe("OpenAlex ingestion", () => {
  test("paginates at 100, saves mocked works, and bounds concurrent writes at eight", async () => {
    const pages = [
      Array.from({ length: 100 }, (_, index) => openAlexWork(`pagination-a-${index}`)),
      [openAlexWork("pagination-b")],
    ];
    const requests: URL[] = [];
    let activeWrites = 0;
    let maximumActiveWrites = 0;

    const result = await runOpenAlexIngestionForTest(
      {
        categoryId: fixtures!.categoryId,
        query: "isolated pagination test",
        limit: 101,
      },
      {
        fetcher: mockOpenAlexPages(pages, requests),
        beforePaperSave: async () => {
          activeWrites += 1;
          maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
          await Bun.sleep(5);
        },
        afterPaperSave: async () => {
          activeWrites -= 1;
        },
      },
    );

    expect(result).toMatchObject({
      status: "success",
      totalFetched: 101,
      totalSaved: 101,
      totalRejected: 0,
      skipped: { duplicates: 0, invalid: 0 },
    });
    expect(requests.map((request) => Number(request.searchParams.get("per-page")))).toEqual([100, 1]);
    expect(requests.every((request) => Number(request.searchParams.get("per-page")) <= 100)).toBe(true);
    expect(maximumActiveWrites).toBe(OPENALEX_INGESTION_CONCURRENCY);
    expect(OPENALEX_INGESTION_CONCURRENCY).toBe(8);
    expect(OPENALEX_REQUEST_MAX_LIMIT).toBe(100);
    expect("rawMetadata" in result).toBe(false);
    expect(JSON.stringify(result)).not.toContain("test_private_metadata");
    expect(result.logPersistence.status).toBe("persisted");
    expect(
      await fixturePrisma.ingestionLog.count({
        where: { id: result.logPersistence.operationId },
      }),
    ).toBe(1);
  });

  test("enforces the 1-500 application limit without contacting OpenAlex", async () => {
    const previousFetch = globalThis.fetch;
    const requests: URL[] = [];
    globalThis.fetch = mockOpenAlexPages([[]], requests);

    try {
      expect(OPENALEX_INGESTION_MAX_LIMIT).toBe(500);
      await admin.admin.ingestion.runOpenAlex({
        categoryId: fixtures!.categoryId,
        query: "limit validation",
        limit: 1,
      });
      await admin.admin.ingestion.runOpenAlex({
        categoryId: fixtures!.categoryId,
        query: "limit validation",
        limit: OPENALEX_INGESTION_MAX_LIMIT,
      });
      await expectTrpcError(
        admin.admin.ingestion.runOpenAlex({
          categoryId: fixtures!.categoryId,
          query: "limit validation",
          limit: OPENALEX_INGESTION_MAX_LIMIT + 1,
        }),
        "BAD_REQUEST",
      );
    } finally {
      globalThis.fetch = previousFetch;
    }

    expect(requests.length).toBe(2);
  });

  test("accounts for normalized database and in-batch duplicates plus invalid metadata", async () => {
    const existingDoiPaper = await createPipelinePaper(fixturePrisma, fixtures!, "existing doi", {
      doi: `10.7777/${fixtures!.runId}.existing`,
    });
    const existingExternalPaper = await createPipelinePaper(
      fixturePrisma,
      fixtures!,
      "existing external id",
    );
    const externalId = `W${Date.now()}8001`;
    await fixturePrisma.paperSource.create({
      data: {
        paperId: existingExternalPaper.id,
        provider: "openalex",
        externalId,
        rawMetadata: {},
      },
    });

    const valid = openAlexWork("dedupe-valid");
    const normalizedValidId = String(valid.id).replace("https://openalex.org/", "");
    const pages = [[
      openAlexWork("database-doi", {
        doi: ` DOI:10.7777/${fixtures!.runId}.EXISTING `,
      }),
      openAlexWork("database-external", { id: `https://openalex.org/${externalId}` }),
      valid,
      openAlexWork("same-batch-doi", { doi: valid.doi }),
      openAlexWork("same-batch-external", { id: normalizedValidId }),
      openAlexWork("malformed", { abstract_inverted_index: null }),
    ]];
    const result = await runOpenAlexIngestionForTest(
      { categoryId: fixtures!.categoryId, query: "isolated duplicate test", limit: 6 },
      { fetcher: mockOpenAlexPages(pages, []) },
    );

    expect(result.totalFetched).toBe(6);
    expect(result.totalSaved).toBe(1);
    expect(result.skipped.duplicates).toBe(4);
    expect(result.skipped.invalid).toBe(1);
    expect(result.totalFetched).toBe(
      result.totalSaved + result.skipped.duplicates + result.skipped.invalid,
    );
    expect(result.status).toBe("partial");
    expect(await fixturePrisma.paper.count({ where: { id: existingDoiPaper.id } })).toBe(1);
  });

  test("reports race-time DOI and external-ID P2002 conflicts as duplicates", async () => {
    const racedDoiWork = openAlexWork("race-doi-duplicate");
    const racedExternalWork = openAlexWork("race-external-duplicate", { doi: null });
    const racedExternalId = String(racedExternalWork.id).replace("https://openalex.org/", "");
    const result = await runOpenAlexIngestionForTest(
      { categoryId: fixtures!.categoryId, query: "isolated race test", limit: 2 },
      {
        fetcher: mockOpenAlexPages([[racedDoiWork, racedExternalWork]], []),
        beforeDatabaseWrites: async () => {
          await createPipelinePaper(fixturePrisma, fixtures!, "race winner", {
            doi: String(racedDoiWork.doi).replace("https://doi.org/", ""),
          });
          const externalRaceWinner = await createPipelinePaper(
            fixturePrisma,
            fixtures!,
            "external race winner",
          );
          await fixturePrisma.paperSource.create({
            data: {
              paperId: externalRaceWinner.id,
              provider: "openalex",
              externalId: racedExternalId,
              rawMetadata: {},
            },
          });
        },
      },
    );

    expect(result).toMatchObject({
      status: "success",
      totalFetched: 2,
      totalSaved: 0,
      totalRejected: 2,
      skipped: { duplicates: 2, invalid: 0 },
    });
  });

  test("keeps saved papers when log finalization fails and retry remains idempotent", async () => {
    const work = openAlexWork("log-finalization-failure");
    const requests: URL[] = [];
    const failedLogResult = await runOpenAlexIngestionForTest(
      { categoryId: fixtures!.categoryId, query: "isolated log failure", limit: 1 },
      {
        fetcher: mockOpenAlexPages([[work]], requests),
        beforeIngestionLogPersist: async () => {
          throw new Error(
            "Prisma Invalid invocation C:\\private\\node_modules SELECT DATABASE_URL",
          );
        },
      },
    );

    expect(failedLogResult.status).toBe("success");
    expect(failedLogResult.totalSaved).toBe(1);
    expect(failedLogResult.logPersistence.status).toBe("failed");
    if (failedLogResult.logPersistence.status !== "failed") {
      throw new Error("Expected the injected ingestion-log finalization failure.");
    }
    expect(failedLogResult.logPersistence.message).toBe(
      "The ingestion result is available, but its operation log could not be persisted.",
    );
    expect(JSON.stringify(failedLogResult)).not.toMatch(
      /Prisma|Invalid invocation|C:\\|node_modules|SELECT|DATABASE_URL/,
    );
    expect(
      await fixturePrisma.ingestionLog.count({
        where: { id: failedLogResult.logPersistence.operationId },
      }),
    ).toBe(0);
    expect(await fixturePrisma.paper.count({ where: { title: String(work.display_name) } })).toBe(1);

    const retryResult = await runOpenAlexIngestionForTest(
      { categoryId: fixtures!.categoryId, query: "isolated log failure retry", limit: 1 },
      { fetcher: mockOpenAlexPages([[work]], requests) },
    );
    expect(retryResult).toMatchObject({
      status: "success",
      totalFetched: 1,
      totalSaved: 0,
      skipped: { duplicates: 1, invalid: 0 },
      logPersistence: { status: "persisted" },
    });
    expect(await fixturePrisma.paper.count({ where: { title: String(work.display_name) } })).toBe(1);
  });
});

describe("classification pipeline", () => {
  test("publishes complete v2.1.4 output and routes quality failures to needs review", async () => {
    const classifiable = await createPipelinePaper(fixturePrisma, fixtures!, "classifiable pending");
    const review = await createPipelinePaper(fixturePrisma, fixtures!, "short abstract pending", {
      abstract: "A short but unusable abstract.",
    });

    const publishedResult = await admin.admin.classification.runForPaper({ paperId: classifiable.id });
    const reviewResult = await admin.admin.classification.runForPaper({ paperId: review.id });
    const [publishedPaper, reviewPaper] = await Promise.all([
      fixturePrisma.paper.findUnique({ where: { id: classifiable.id }, include: { classification: true } }),
      fixturePrisma.paper.findUnique({ where: { id: review.id }, include: { classification: true } }),
    ]);

    expect(publishedResult.status).toBe("published");
    expect(publishedResult.classificationVersion).toBe(CLASSIFICATION_VERSION);
    expect(publishedPaper?.status).toBe("published");
    expect(publishedPaper?.classification?.classificationVersion).toBe("rule-based-v2.1.4");
    expect(publishedPaper?.classification?.beginnerScore).toBeNumber();
    expect(publishedPaper?.classification?.classificationReason.length).toBeGreaterThan(0);
    expect(reviewResult.status).toBe("needs_review");
    expect(reviewPaper?.status).toBe("needs_review");
    expect(reviewPaper?.classification).toBeNull();
  });

  test("reclassification is audited and stale inactive papers are rejected", async () => {
    const reviewPaper = await createPipelinePaper(fixturePrisma, fixtures!, "reclassify eligible", {
      status: "needs_review",
    });
    const inactivePaper = await createPipelinePaper(fixturePrisma, fixtures!, "inactive classification", {
      status: "inactive",
    });
    const stillNeedsReview = await createPipelinePaper(
      fixturePrisma,
      fixtures!,
      "reclassification quality failure",
      {
        status: "needs_review",
        abstract: "Still too short for reliable automated classification.",
      },
    );

    const result = await admin.admin.papers.reclassify({ paperId: reviewPaper.id });
    expect(result.outcome).toBe("published");
    expect(result.classificationVersion).toBe("rule-based-v2.1.4");
    expect(
      await fixturePrisma.adminPaperAuditLog.count({
        where: { paperId: reviewPaper.id, action: "paper_reclassified" },
      }),
    ).toBe(1);
    const reviewResult = await admin.admin.papers.reclassify({ paperId: stillNeedsReview.id });
    expect(reviewResult.outcome).toBe("needs_review");
    expect(reviewResult.reviewReasons.length).toBeGreaterThan(0);
    expect(
      (await fixturePrisma.paper.findUnique({ where: { id: stillNeedsReview.id } }))?.status,
    ).toBe("needs_review");
    await expectTrpcError(
      admin.admin.classification.runForPaper({ paperId: inactivePaper.id }),
      "BAD_REQUEST",
    );
    expect((await fixturePrisma.paper.findUnique({ where: { id: inactivePaper.id } }))?.status).toBe(
      "inactive",
    );
  });

  test("batch failures are isolated and sanitized while concurrency remains eight", async () => {
    const category = await createCategory("classification batch category");
    const batchPapers = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        fixturePrisma.paper.create({
          data: {
            id: randomUUID(),
            title: `${fixtures!.runId} batch classification ${index}`,
            abstract: buildClassifiableAbstract(`batch-${index}`),
            authors: ["Batch Integration Author"],
            publicationYear: 2026,
            sourceName: "Integration test",
            sourceUrl: `https://example.test/${fixtures!.runId}/batch-${index}`,
            categoryId: category.id,
            status: "pending",
          },
        }),
      ),
    );
    const failedPaperId = batchPapers[0]!.id;
    let active = 0;
    let maximumActive = 0;

    const result = await classifyPendingPapersForTest(
      { categoryId: category.id, limit: 10 },
      {
        beforePaper: async (paperId) => {
          active += 1;
          maximumActive = Math.max(maximumActive, active);
          await Bun.sleep(10);
          if (paperId === failedPaperId) {
            throw new Error("Prisma Invalid invocation C:\\private\\node_modules SELECT DATABASE_URL");
          }
        },
        afterPaper: async () => {
          active -= 1;
        },
      },
    );

    expect(CLASSIFICATION_BATCH_MAX_LIMIT).toBe(500);
    expect(CLASSIFICATION_BATCH_CONCURRENCY).toBe(8);
    expect(maximumActive).toBe(CLASSIFICATION_BATCH_CONCURRENCY);
    expect(result.totalFound).toBe(10);
    expect(result.totalFailed).toBe(1);
    expect(result.totalPublished).toBe(9);
    expect(result.totalSkipped).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Classification failed due to an internal processing error.");
    expect(result.errors[0]).not.toMatch(/Prisma|Invalid invocation|C:\\|node_modules|SELECT|DATABASE_URL/);
    expect((await fixturePrisma.paper.findUnique({ where: { id: failedPaperId } }))?.status).toBe(
      "needs_review",
    );
  });

  test("overlapping batches atomically claim each pending paper once", async () => {
    const category = await createCategory("overlapping batch category");
    const papers = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        fixturePrisma.paper.create({
          data: {
            id: randomUUID(),
            title: `${fixtures!.runId} overlapping classification ${index}`,
            abstract: buildClassifiableAbstract(`overlap-${index}`),
            authors: ["Concurrent Batch Author"],
            publicationYear: 2026,
            sourceName: "Integration test",
            sourceUrl: `https://example.test/${fixtures!.runId}/overlap-${index}`,
            categoryId: category.id,
            status: "pending",
          },
        }),
      ),
    );
    let fetchedBatchCount = 0;
    let releaseBatches: (() => void) | undefined;
    const bothBatchesFetched = new Promise<void>((resolve) => {
      releaseBatches = resolve;
    });
    const afterFetch = async (paperIds: string[]) => {
      expect(paperIds).toHaveLength(papers.length);
      fetchedBatchCount += 1;
      if (fetchedBatchCount === 2) {
        releaseBatches?.();
      }
      await bothBatchesFetched;
    };

    const [first, second] = await Promise.all([
      classifyPendingPapersForTest(
        { categoryId: category.id, limit: papers.length },
        { afterFetch },
      ),
      classifyPendingPapersForTest(
        { categoryId: category.id, limit: papers.length },
        { afterFetch },
      ),
    ]);
    const results = [first, second];
    const processed = results.reduce(
      (total, result) =>
        total +
        result.totalPublished +
        result.totalNeedsReview +
        result.totalRejected +
        result.totalFailed,
      0,
    );

    expect(processed).toBe(papers.length);
    expect(results.reduce((total, result) => total + result.totalSkipped, 0)).toBe(papers.length);
    for (const result of results) {
      expect(result.totalFound).toBe(
        result.totalPublished +
          result.totalNeedsReview +
          result.totalRejected +
          result.totalFailed +
          result.totalSkipped,
      );
      expect(result.skipped).toHaveLength(result.totalSkipped);
      expect(result.skipped.every((item) => item.reason === "already_claimed")).toBe(true);
    }
    expect(
      await fixturePrisma.paperClassification.count({
        where: { paperId: { in: papers.map((paper) => paper.id) } },
      }),
    ).toBe(papers.length);
    expect(
      await fixturePrisma.paper.count({
        where: { id: { in: papers.map((paper) => paper.id) }, status: "published" },
      }),
    ).toBe(papers.length);
    expect(
      await fixturePrisma.adminPaperAuditLog.count({
        where: { paperId: { in: papers.map((paper) => paper.id) } },
      }),
    ).toBe(0);
  });
});

describe("admin remediation", () => {
  test("metadata updates normalize authors, preserve relations, and enforce validation and admin access", async () => {
    const paper = await createPipelinePaper(fixturePrisma, fixtures!, "metadata remediation", {
      status: "published",
      withClassification: true,
    });
    const source = await fixturePrisma.paperSource.create({
      data: {
        paperId: paper.id,
        provider: "openalex",
        externalId: `W${Date.now()}9101`,
        rawMetadata: {},
      },
    });
    const [bookmark, note, progress] = await Promise.all([
      fixturePrisma.bookmark.create({ data: { paperId: paper.id, userId: fixtures!.userA.id } }),
      fixturePrisma.readingNote.create({
        data: { paperId: paper.id, userId: fixtures!.userA.id, note: "Metadata relation fixture" },
      }),
      fixturePrisma.readingProgress.create({
        data: {
          paperId: paper.id,
          userId: fixtures!.userA.id,
          status: "reading",
          progressPercentage: 30,
        },
      }),
    ]);

    const updated = await admin.admin.papers.updateMetadata({
      paperId: paper.id,
      authors: ["  Ada Lovelace ", "ada lovelace", "Grace Hopper"],
      abstract: "Updated metadata abstract with sufficient detail.",
      publicationYear: 2025,
      sourceUrl: "https://example.test/updated-source",
      pdfUrl: null,
    });
    expect(updated.authors).toEqual(["Ada Lovelace", "Grace Hopper"]);
    expect(updated.paperId).toBe(paper.id);
    expect(await fixturePrisma.paperSource.count({ where: { id: source.id, paperId: paper.id } })).toBe(1);
    expect(await fixturePrisma.bookmark.count({ where: { id: bookmark.id, paperId: paper.id } })).toBe(1);
    expect(await fixturePrisma.readingNote.count({ where: { id: note.id, paperId: paper.id } })).toBe(1);
    expect(await fixturePrisma.readingProgress.count({ where: { id: progress.id, paperId: paper.id } })).toBe(1);
    const metadataAudit = await fixturePrisma.adminPaperAuditLog.findFirst({
      where: { paperId: paper.id, action: "paper_metadata_updated" },
    });
    expect(JSON.stringify(metadataAudit)).not.toContain("Metadata relation fixture");

    await expectTrpcError(
      admin.admin.papers.updateMetadata({ paperId: paper.id, publicationYear: 1800 }),
      "BAD_REQUEST",
    );
    await expectTrpcError(
      admin.admin.papers.updateMetadata({ paperId: paper.id, sourceUrl: "ftp://example.test/paper" }),
      "BAD_REQUEST",
    );
    await expectTrpcError(
      normalUser.admin.papers.updateMetadata({ paperId: paper.id, authors: ["Unauthorized User"] }),
      "FORBIDDEN",
    );
  });

  test("manual publication, direct-publish blocking, reject, and inactive transitions follow the workflow", async () => {
    const manualPaper = await createPipelinePaper(fixturePrisma, fixtures!, "manual publication", {
      status: "needs_review",
    });
    const directPublishPaper = await createPipelinePaper(fixturePrisma, fixtures!, "direct publish blocked", {
      status: "pending",
    });
    const rejectPaper = await createPipelinePaper(fixturePrisma, fixtures!, "reject transition", {
      status: "needs_review",
    });
    const inactivePaper = await createPipelinePaper(fixturePrisma, fixtures!, "inactive transition", {
      status: "needs_review",
    });

    await expectTrpcError(
      admin.admin.papers.manualClassifyAndPublish({
        paperId: manualPaper.id,
        difficulty: "moderate",
        reason: "too short",
      }),
      "BAD_REQUEST",
    );
    const invalidDifficulty = admin.admin.papers.manualClassifyAndPublish as unknown as (input: {
      paperId: string;
      difficulty: string;
      reason: string;
    }) => Promise<unknown>;
    await expectTrpcError(
      invalidDifficulty({
        paperId: manualPaper.id,
        difficulty: "advanced",
        reason: "This value is outside the supported manual difficulty contract.",
      }),
      "BAD_REQUEST",
    );
    const manualResult = await admin.admin.papers.manualClassifyAndPublish({
      paperId: manualPaper.id,
      difficulty: "difficult",
      reason: "Admin reviewed the complete metadata and approved this manual classification.",
    });
    const storedManual = await fixturePrisma.paperClassification.findUnique({
      where: { paperId: manualPaper.id },
    });
    expect(manualResult.classificationVersion).toBe(MANUAL_CLASSIFICATION_VERSION);
    expect(storedManual?.classificationVersion).toBe("manual-admin-v1");
    expect(storedManual?.beginnerScore).toBeNull();
    expect((await fixturePrisma.paper.findUnique({ where: { id: manualPaper.id } }))?.status).toBe(
      "published",
    );
    expect(
      await fixturePrisma.adminPaperAuditLog.count({
        where: { paperId: manualPaper.id, action: "paper_manually_classified" },
      }),
    ).toBe(1);

    await expectTrpcError(admin.admin.papers.publish({ paperId: directPublishPaper.id }), "BAD_REQUEST");
    expect((await admin.admin.papers.reject({ paperId: rejectPaper.id })).status).toBe("rejected");
    expect((await admin.admin.papers.deactivate({ paperId: inactivePaper.id })).status).toBe("inactive");
  });
});

describe("duplicate-title resolution", () => {
  test("keep both records an exact fingerprint without modifying papers and changed membership reappears", async () => {
    const title = `${fixtures!.runId} distinct papers sharing reviewed title`;
    const first = await createPipelinePaper(fixturePrisma, fixtures!, "keep both first", {
      title,
      status: "published",
      withClassification: true,
    });
    const second = await createPipelinePaper(fixturePrisma, fixtures!, "keep both second", {
      title,
      status: "needs_review",
    });
    await fixturePrisma.bookmark.create({ data: { userId: fixtures!.userA.id, paperId: first.id } });
    const group = (await duplicateGroups()).find((candidate) =>
      candidate.papers.some((paper) => paper.paperId === first.id),
    )!;

    const result = await admin.admin.dataQuality.resolveDuplicateGroup({
      resolution: "keep_both",
      groupKey: group.groupKey,
      paperIds: [first.id, second.id],
      reason: "The records represent distinct works after an explicit metadata review.",
    });
    expect(result.resolution).toBe("keep_both");
    expect(
      await fixturePrisma.duplicateGroupResolution.count({
        where: { groupFingerprint: result.groupFingerprint, resolution: "keep_both" },
      }),
    ).toBe(1);
    expect((await fixturePrisma.paper.findUnique({ where: { id: first.id } }))?.status).toBe("published");
    expect((await fixturePrisma.paper.findUnique({ where: { id: second.id } }))?.status).toBe("needs_review");
    expect(await fixturePrisma.bookmark.count({ where: { paperId: first.id } })).toBe(1);
    expect((await duplicateGroups()).some((candidate) => candidate.groupKey === group.groupKey)).toBe(false);

    await expectTrpcError(
      admin.admin.dataQuality.resolveDuplicateGroup({
        resolution: "keep_both",
        groupKey: group.groupKey,
        paperIds: [first.id, second.id],
        reason: "The same exact reviewed set must not be resolved more than once.",
      }),
      "CONFLICT",
    );

    await createPipelinePaper(fixturePrisma, fixtures!, "keep both new member", {
      title,
      status: "pending",
    });
    const changedGroup = (await duplicateGroups()).find(
      (candidate) => candidate.groupKey === group.groupKey,
    );
    expect(changedGroup?.papers).toHaveLength(3);
  });

  test("safe merge preserves the selected paper and consolidates sources and user relations", async () => {
    const title = `${fixtures!.runId} confirmed duplicate merge candidate study`;
    const canonical = await createPipelinePaper(fixturePrisma, fixtures!, "merge retained", {
      title,
      status: "published",
      withClassification: true,
      difficulty: "difficult",
    });
    const duplicate = await createPipelinePaper(fixturePrisma, fixtures!, "merge duplicate", {
      title,
      status: "published",
      withClassification: true,
    });
    const normalizedExternalId = `W${Date.now()}9201`;
    await fixturePrisma.paperSource.createMany({
      data: [
        {
          paperId: canonical.id,
          provider: "openalex",
          externalId: normalizedExternalId,
          rawMetadata: {},
        },
        {
          paperId: duplicate.id,
          provider: "openalex",
          externalId: `https://openalex.org/${normalizedExternalId}`,
          rawMetadata: {},
        },
        {
          paperId: duplicate.id,
          provider: "crossref",
          externalId: `${fixtures!.runId}-crossref-merge`,
          rawMetadata: {},
        },
      ],
    });
    const early = new Date("2026-01-01T00:00:00.000Z");
    const late = new Date("2026-02-01T00:00:00.000Z");
    await fixturePrisma.bookmark.createMany({
      data: [
        { userId: fixtures!.userA.id, paperId: canonical.id, createdAt: late },
        { userId: fixtures!.userA.id, paperId: duplicate.id, createdAt: early },
        { userId: fixtures!.userB.id, paperId: duplicate.id },
      ],
    });
    const note = await fixturePrisma.readingNote.create({
      data: { userId: fixtures!.userA.id, paperId: duplicate.id, note: "Private merge fixture note" },
    });
    await fixturePrisma.readingProgress.createMany({
      data: [
        {
          userId: fixtures!.userA.id,
          paperId: canonical.id,
          status: "reading",
          progressPercentage: 60,
          startedAt: early,
          lastReadAt: early,
        },
        {
          userId: fixtures!.userA.id,
          paperId: duplicate.id,
          status: "completed",
          progressPercentage: 100,
          startedAt: late,
          completedAt: late,
          lastReadAt: late,
        },
        {
          userId: fixtures!.userB.id,
          paperId: duplicate.id,
          status: "reading",
          progressPercentage: 35,
          startedAt: late,
          lastReadAt: late,
        },
      ],
    });
    const originalCanonical = await fixturePrisma.paper.findUnique({
      where: { id: canonical.id },
      include: { classification: true },
    });
    const group = (await duplicateGroups()).find((candidate) =>
      candidate.papers.some((paper) => paper.paperId === canonical.id),
    )!;

    const result = await admin.admin.dataQuality.resolveDuplicateGroup({
      resolution: "merge",
      groupKey: group.groupKey,
      canonicalPaperId: canonical.id,
      duplicatePaperIds: [duplicate.id],
      reason: "The records were confirmed as the same work after identifier and metadata review.",
    });
    const retained = await fixturePrisma.paper.findUnique({
      where: { id: canonical.id },
      include: { classification: true },
    });
    const mergedProgress = await fixturePrisma.readingProgress.findMany({
      where: { paperId: canonical.id },
      orderBy: { userId: "asc" },
    });

    expect(result).toMatchObject({
      resolution: "merge",
      canonicalPaperId: canonical.id,
      duplicatePaperIds: [duplicate.id],
      moved: { sources: 1, bookmarks: 1, notes: 1, readingProgress: 1 },
      deduplicated: { sources: 1, bookmarks: 1, readingProgress: 1 },
      inactivePapers: 1,
    });
    expect(retained?.id).toBe(originalCanonical?.id);
    expect(retained?.title).toBe(originalCanonical?.title);
    expect(retained?.abstract).toBe(originalCanonical?.abstract);
    expect(retained?.classification).toEqual(originalCanonical?.classification);
    expect((await fixturePrisma.paper.findUnique({ where: { id: duplicate.id } }))?.status).toBe("inactive");
    expect(await fixturePrisma.paperSource.count({ where: { paperId: canonical.id } })).toBe(2);
    expect(await fixturePrisma.paperSource.count({ where: { paperId: duplicate.id } })).toBe(0);
    expect(await fixturePrisma.bookmark.count({ where: { paperId: canonical.id } })).toBe(2);
    expect(await fixturePrisma.readingNote.count({ where: { id: note.id, paperId: canonical.id } })).toBe(1);
    expect(mergedProgress).toHaveLength(2);
    expect(
      mergedProgress.some(
        (progress) =>
          progress.userId === fixtures!.userA.id &&
          progress.status === "completed" &&
          progress.progressPercentage === 100 &&
          progress.startedAt?.getTime() === early.getTime() &&
          progress.lastReadAt?.getTime() === late.getTime(),
      ),
    ).toBe(true);
    expect(await fixturePrisma.paper.count({ where: { id: duplicate.id } })).toBe(1);
    expect(
      await fixturePrisma.adminPaperAuditLog.count({
        where: { paperId: canonical.id, action: "duplicate_group_merged" },
      }),
    ).toBe(1);
    expect(
      await fixturePrisma.duplicateGroupResolution.count({
        where: { groupFingerprint: result.groupFingerprint, resolution: "merge" },
      }),
    ).toBe(1);
    expect((await duplicateGroups()).some((candidate) => candidate.groupKey === group.groupKey)).toBe(false);
  });

  test("an injected failure rolls back every merge write", async () => {
    const title = `${fixtures!.runId} rollback duplicate transaction candidate`;
    const canonical = await createPipelinePaper(fixturePrisma, fixtures!, "rollback retained", {
      title,
      status: "published",
      withClassification: true,
    });
    const duplicate = await createPipelinePaper(fixturePrisma, fixtures!, "rollback duplicate", {
      title,
      status: "published",
      withClassification: true,
    });
    const externalId = `W${Date.now()}9301`;
    await fixturePrisma.paperSource.createMany({
      data: [
        { paperId: canonical.id, provider: "openalex", externalId, rawMetadata: {} },
        {
          paperId: duplicate.id,
          provider: "openalex",
          externalId: `https://openalex.org/${externalId}`,
          rawMetadata: {},
        },
      ],
    });
    await fixturePrisma.bookmark.createMany({
      data: [
        { userId: fixtures!.userA.id, paperId: canonical.id },
        { userId: fixtures!.userA.id, paperId: duplicate.id },
      ],
    });
    const note = await fixturePrisma.readingNote.create({
      data: { userId: fixtures!.userA.id, paperId: duplicate.id, note: "Rollback fixture note" },
    });
    await fixturePrisma.readingProgress.createMany({
      data: [
        { userId: fixtures!.userA.id, paperId: canonical.id, status: "reading", progressPercentage: 20 },
        { userId: fixtures!.userA.id, paperId: duplicate.id, status: "reading", progressPercentage: 80 },
      ],
    });
    const group = (await duplicateGroups()).find((candidate) =>
      candidate.papers.some((paper) => paper.paperId === canonical.id),
    )!;
    const paperIds = [canonical.id, duplicate.id];
    const before = {
      papers: await fixturePrisma.paper.findMany({
        where: { id: { in: paperIds } },
        orderBy: { id: "asc" },
        select: { id: true, status: true },
      }),
      sources: await fixturePrisma.paperSource.findMany({
        where: { paperId: { in: paperIds } },
        orderBy: { id: "asc" },
        select: { id: true, paperId: true },
      }),
      bookmarks: await fixturePrisma.bookmark.findMany({
        where: { paperId: { in: paperIds } },
        orderBy: { id: "asc" },
        select: { id: true, paperId: true },
      }),
      progress: await fixturePrisma.readingProgress.findMany({
        where: { paperId: { in: paperIds } },
        orderBy: { id: "asc" },
        select: { id: true, paperId: true, status: true, progressPercentage: true },
      }),
    };

    await expect(
      resolveDuplicateGroupWithRollbackProbeForTest(fixtures!.admin.id, {
        resolution: "merge",
        groupKey: group.groupKey,
        canonicalPaperId: canonical.id,
        duplicatePaperIds: [duplicate.id],
        reason: "This controlled integration failure verifies complete transactional rollback.",
      }),
    ).rejects.toThrow("Failed to resolve duplicate group");

    expect(
      await fixturePrisma.paper.findMany({
        where: { id: { in: paperIds } },
        orderBy: { id: "asc" },
        select: { id: true, status: true },
      }),
    ).toEqual(before.papers);
    expect(
      await fixturePrisma.paperSource.findMany({
        where: { paperId: { in: paperIds } },
        orderBy: { id: "asc" },
        select: { id: true, paperId: true },
      }),
    ).toEqual(before.sources);
    expect(
      await fixturePrisma.bookmark.findMany({
        where: { paperId: { in: paperIds } },
        orderBy: { id: "asc" },
        select: { id: true, paperId: true },
      }),
    ).toEqual(before.bookmarks);
    expect(
      await fixturePrisma.readingProgress.findMany({
        where: { paperId: { in: paperIds } },
        orderBy: { id: "asc" },
        select: { id: true, paperId: true, status: true, progressPercentage: true },
      }),
    ).toEqual(before.progress);
    expect(await fixturePrisma.readingNote.count({ where: { id: note.id, paperId: duplicate.id } })).toBe(1);
    expect(
      await fixturePrisma.duplicateGroupResolution.count({
        where: { groupKey: group.groupKey },
      }),
    ).toBe(0);
    expect(
      await fixturePrisma.adminPaperAuditLog.count({
        where: { paperId: canonical.id, action: "duplicate_group_merged" },
      }),
    ).toBe(0);
  });
});
