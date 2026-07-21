import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";

import { loadTestDatabaseEnvironment } from "@deepread/db/test-database-environment";
import { createTestDatabaseClient } from "@deepread/db/test-database-client";

import type { AppRouter } from "../../routers";
import {
  cleanupReadingWorkflowFixtures,
  createReadingWorkflowFixtures,
  type ReadingWorkflowFixtures,
} from "./reading-workflow-fixtures";
import { expectTrpcError } from "./test-assertions";
import { createUserContext } from "./test-context";
import { cleanupCurrentTestRun, createTestRunId } from "./test-fixtures";

type Caller = ReturnType<AppRouter["createCaller"]>;

setDefaultTimeout(30_000);

const environment = loadTestDatabaseEnvironment();
const fixturePrisma = createTestDatabaseClient(environment.databaseUrl);

let fixtures: ReadingWorkflowFixtures | null = null;
let userA: Caller;
let userB: Caller;
let appPrisma: typeof import("@deepread/db").default;

beforeAll(async () => {
  const runId = createTestRunId();

  try {
    fixtures = await createReadingWorkflowFixtures(fixturePrisma, runId);
  } catch (error) {
    await cleanupCurrentTestRun(fixturePrisma, runId).catch(() => undefined);
    const errorType = error instanceof Error ? error.name : typeof error;
    throw new Error(
      `Unable to create isolated reading fixtures (${errorType}). Apply migrations with bun run test:integration:migrate and verify the test database configuration.`,
    );
  }

  const [{ appRouter }, dbModule] = await Promise.all([import("../../routers"), import("@deepread/db")]);
  appPrisma = dbModule.default;
  userA = appRouter.createCaller(createUserContext(fixtures.userA));
  userB = appRouter.createCaller(createUserContext(fixtures.userB));
});

afterAll(async () => {
  try {
    await cleanupReadingWorkflowFixtures(fixturePrisma, fixtures);
  } finally {
    await Promise.all([fixturePrisma.$disconnect(), appPrisma?.$disconnect()]);
  }
});

describe("reading progress", () => {
  test("starts, updates, validates, and completes one user-paper progress record", async () => {
    const currentFixtures = fixtures!;
    const paperId = currentFixtures.publishedPaperIds.readingWorkflow;

    const started = await userA.reading.start({ paperId });
    expect(started.status).toBe("reading");
    expect(started.progressPercentage).toBe(0);
    expect(started.startedAt).not.toBeNull();

    const firstUpdate = await userA.reading.updateProgress({ paperId, progressPercentage: 45 });
    const secondUpdate = await userA.reading.updateProgress({ paperId, progressPercentage: 70 });
    expect(firstUpdate.id).toBe(started.id);
    expect(secondUpdate.id).toBe(started.id);
    expect(secondUpdate.progressPercentage).toBe(70);

    await expectTrpcError(userA.reading.updateProgress({ paperId, progressPercentage: 101 }), "BAD_REQUEST");
    const afterRejectedUpdate = await userA.reading.getForPaper({ paperId });
    expect(afterRejectedUpdate?.progressPercentage).toBe(70);

    const completed = await userA.reading.complete({ paperId });
    expect(completed.id).toBe(started.id);
    expect(completed.status).toBe("completed");
    expect(completed.progressPercentage).toBe(100);
    expect(completed.completedAt).not.toBeNull();
    expect(
      await fixturePrisma.readingProgress.count({
        where: { userId: currentFixtures.userA.id, paperId },
      }),
    ).toBe(1);
  });

  test("one user cannot read or modify another user's progress", async () => {
    const currentFixtures = fixtures!;
    const paperId = currentFixtures.publishedPaperIds.statsReading;

    expect(await userA.reading.getForPaper({ paperId })).toBeNull();
    const userAProgress = await userA.reading.updateProgress({ paperId, progressPercentage: 65 });
    const userBProgress = await userB.reading.getForPaper({ paperId });

    expect(userAProgress.id).not.toBe(currentFixtures.stats.readingProgressId);
    expect(userBProgress?.id).toBe(currentFixtures.stats.readingProgressId);
    expect(userBProgress?.progressPercentage).toBe(40);
    expect(
      await fixturePrisma.readingProgress.count({
        where: { paperId, userId: { in: [currentFixtures.userA.id, currentFixtures.userB.id] } },
      }),
    ).toBe(2);
  });

  test("unpublished papers reject all user-facing progress writes", async () => {
    const currentFixtures = fixtures!;
    for (const paperId of Object.values(currentFixtures.unpublishedPaperIds)) {
      await expectTrpcError(userA.reading.start({ paperId }), "NOT_FOUND", "Paper not found");
    }

    const pendingPaperId = currentFixtures.unpublishedPaperIds.pending;
    await expectTrpcError(
      userA.reading.updateProgress({ paperId: pendingPaperId, progressPercentage: 50 }),
      "NOT_FOUND",
      "Paper not found",
    );
    await expectTrpcError(userA.reading.complete({ paperId: pendingPaperId }), "NOT_FOUND", "Paper not found");
    expect(
      await fixturePrisma.readingProgress.count({
        where: {
          userId: currentFixtures.userA.id,
          paperId: { in: Object.values(currentFixtures.unpublishedPaperIds) },
        },
      }),
    ).toBe(0);
  });
});

describe("bookmarks", () => {
  test("add, repeat, list, and remove are idempotent and session-owned", async () => {
    const currentFixtures = fixtures!;
    const paperId = currentFixtures.publishedPaperIds.bookmarkWorkflow;

    const first = await userA.bookmark.add({ paperId });
    const repeated = await userA.bookmark.add({ paperId });
    expect(repeated.id).toBe(first.id);

    const addWithForgedOwner = userA.bookmark.add as unknown as (input: {
      paperId: string;
      userId: string;
    }) => ReturnType<typeof userA.bookmark.add>;
    await addWithForgedOwner({ paperId, userId: currentFixtures.userB.id });
    expect(
      await fixturePrisma.bookmark.count({ where: { userId: currentFixtures.userA.id, paperId } }),
    ).toBe(1);
    expect(
      await fixturePrisma.bookmark.count({ where: { userId: currentFixtures.userB.id, paperId } }),
    ).toBe(0);

    const userBBookmark = await userB.bookmark.add({ paperId });
    expect(userBBookmark.id).not.toBe(first.id);
    const [userAList, userBList] = await Promise.all([userA.bookmark.list(), userB.bookmark.list()]);
    expect(userAList.some((bookmark) => bookmark.id === first.id)).toBe(true);
    expect(userBList.some((bookmark) => bookmark.id === userBBookmark.id)).toBe(true);

    const removed = await userA.bookmark.remove({ paperId });
    const repeatedRemoval = await userA.bookmark.remove({ paperId });
    expect(removed).toEqual({ success: true, removed: true });
    expect(repeatedRemoval).toEqual({ success: true, removed: false });
    expect((await userB.bookmark.getForPaper({ paperId })).isBookmarked).toBe(true);

    await userB.bookmark.remove({ paperId });
  });

  test("unpublished papers cannot be bookmarked", async () => {
    const currentFixtures = fixtures!;
    for (const paperId of Object.values(currentFixtures.unpublishedPaperIds)) {
      await expectTrpcError(userA.bookmark.add({ paperId }), "NOT_FOUND", "Paper not found");
    }

    expect(
      await fixturePrisma.bookmark.count({
        where: {
          userId: currentFixtures.userA.id,
          paperId: { in: Object.values(currentFixtures.unpublishedPaperIds) },
        },
      }),
    ).toBe(0);
  });
});

describe("notes", () => {
  test("create, list, group, update, and delete follow the current contract", async () => {
    const currentFixtures = fixtures!;
    const paperId = currentFixtures.publishedPaperIds.notesWorkflow;
    const created = await userA.notes.create({
      paperId,
      note: "Reading workflow note fixture",
      section: "Methods",
    });
    expect(created.paperId).toBe(paperId);
    expect(created.section).toBe("Methods");

    const listed = await userA.notes.listForPaper({ paperId });
    expect(listed.some((note) => note.id === created.id)).toBe(true);
    const grouped = await userA.notes.listMineGroupedByPaper();
    const paperGroup = grouped.papers.find((group) => group.paper.id === paperId);
    expect(paperGroup?.noteCount).toBe(1);
    expect(paperGroup?.notes.some((note) => note.id === created.id)).toBe(true);

    const updated = await userA.notes.update({
      noteId: created.id,
      note: "Updated reading workflow note fixture",
      section: "Results",
    });
    expect(updated.id).toBe(created.id);
    expect(updated.section).toBe("Results");
    const storedNote = await fixturePrisma.readingNote.findUnique({
      where: { id: created.id },
      select: { note: true },
    });
    expect(storedNote?.note === "Updated reading workflow note fixture").toBe(true);

    expect(await userA.notes.delete({ noteId: created.id })).toEqual({ success: true });
    expect(await fixturePrisma.readingNote.count({ where: { id: created.id } })).toBe(0);
  });

  test("notes cannot be read, updated, or deleted across users", async () => {
    const currentFixtures = fixtures!;
    const paperId = currentFixtures.publishedPaperIds.notesWorkflow;
    const created = await userA.notes.create({ paperId, note: "Cross-user isolation fixture" });

    try {
      const userBNotes = await userB.notes.listForPaper({ paperId });
      expect(userBNotes.some((note) => note.id === created.id)).toBe(false);
      await expectTrpcError(
        userB.notes.update({ noteId: created.id, note: "Cross-user update attempt" }),
        "FORBIDDEN",
      );
      await expectTrpcError(userB.notes.delete({ noteId: created.id }), "FORBIDDEN");
      expect(await fixturePrisma.readingNote.count({ where: { id: created.id } })).toBe(1);
    } finally {
      await userA.notes.delete({ noteId: created.id });
    }
  });

  test("unpublished papers cannot receive notes", async () => {
    const currentFixtures = fixtures!;
    for (const paperId of Object.values(currentFixtures.unpublishedPaperIds)) {
      await expectTrpcError(
        userA.notes.create({ paperId, note: "Unpublished paper note attempt" }),
        "NOT_FOUND",
        "Paper not found",
      );
    }

    expect(
      await fixturePrisma.readingNote.count({
        where: {
          userId: currentFixtures.userA.id,
          paperId: { in: Object.values(currentFixtures.unpublishedPaperIds) },
        },
      }),
    ).toBe(0);
  });
});

describe("statistics", () => {
  test("calculates deterministic session-owned reading totals and distributions", async () => {
    const currentFixtures = fixtures!;
    const statistics = await userB.statistics.getMine();

    expect(statistics.summary).toEqual({
      totalCompleted: 1,
      totalReading: 1,
      totalBookmarked: 1,
      totalNotes: 1,
      estimatedCompletedReadingTime: 25,
      averageReadingProgress: 70,
    });

    const difficult = statistics.difficultyDistribution.find(
      (item) => item.difficultyLevel === "difficult",
    );
    expect(difficult?.count).toBe(1);
    expect(
      statistics.difficultyDistribution
        .filter((item) => item.difficultyLevel !== "difficult")
        .every((item) => item.count === 0),
    ).toBe(true);

    const category = statistics.categoryDistribution.find(
      (item) => item.categoryId === currentFixtures.categoryId,
    );
    expect(category?.count).toBe(2);
    expect(
      statistics.recentCompletedPapers.some(
        (item) => item.paper.id === currentFixtures.publishedPaperIds.statsCompleted,
      ),
    ).toBe(true);
    expect(
      statistics.recentReadingActivity.some(
        (item) => item.type === "completed" && item.paper.id === currentFixtures.publishedPaperIds.statsCompleted,
      ),
    ).toBe(true);
  });
});
