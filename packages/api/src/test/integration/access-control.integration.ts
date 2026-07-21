import { afterAll, beforeAll, describe, expect, setDefaultTimeout, test } from "bun:test";

import { loadTestDatabaseEnvironment } from "@deepread/db/test-database-environment";
import { createTestDatabaseClient } from "@deepread/db/test-database-client";

import type { AppRouter } from "../../routers";
import { expectTrpcError } from "./test-assertions";
import { createGuestContext, createUserContext } from "./test-context";
import {
  cleanupAccessControlFixtures,
  cleanupCurrentTestRun,
  createAccessControlFixtures,
  createTestRunId,
  type AccessControlFixtures,
} from "./test-fixtures";

type Caller = ReturnType<AppRouter["createCaller"]>;

setDefaultTimeout(30_000);

const environment = loadTestDatabaseEnvironment();
const fixturePrisma = createTestDatabaseClient(environment.databaseUrl);

let fixtures: AccessControlFixtures | null = null;
let guest: Caller;
let userA: Caller;
let userB: Caller;
let admin: Caller;
let appPrisma: typeof import("@deepread/db").default;

beforeAll(async () => {
  const runId = createTestRunId();

  try {
    fixtures = await createAccessControlFixtures(fixturePrisma, runId);
  } catch (error) {
    await cleanupCurrentTestRun(fixturePrisma, runId).catch(() => undefined);
    const errorType = error instanceof Error ? error.name : typeof error;
    throw new Error(
      `Unable to create isolated fixtures (${errorType}). Apply migrations with bun run test:integration:migrate and verify the test database configuration.`,
    );
  }

  const [{ appRouter }, dbModule] = await Promise.all([import("../../routers"), import("@deepread/db")]);
  appPrisma = dbModule.default;
  guest = appRouter.createCaller(createGuestContext());
  userA = appRouter.createCaller(createUserContext(fixtures.userA));
  userB = appRouter.createCaller(createUserContext(fixtures.userB));
  admin = appRouter.createCaller(createUserContext(fixtures.admin));
});

afterAll(async () => {
  try {
    await cleanupAccessControlFixtures(fixturePrisma, fixtures);
  } finally {
    await Promise.all([fixturePrisma.$disconnect(), appPrisma?.$disconnect()]);
  }
});

describe("public paper visibility", () => {
  test("guest and authenticated lists expose only the published fixture", async () => {
    const currentFixtures = fixtures!;
    const [guestResult, userResult] = await Promise.all([
      guest.papers.list({ q: currentFixtures.runId, limit: 50 }),
      userA.papers.list({ q: currentFixtures.runId, limit: 50 }),
    ]);

    const fixturePaperIds = new Set(Object.values(currentFixtures.paperIds));
    const expectedIds = [currentFixtures.paperIds.published];

    expect(guestResult.papers.filter((paper) => fixturePaperIds.has(paper.id)).map((paper) => paper.id)).toEqual(
      expectedIds,
    );
    expect(userResult.papers.filter((paper) => fixturePaperIds.has(paper.id)).map((paper) => paper.id)).toEqual(
      expectedIds,
    );
  });

  test("public detail returns published data and identical not-found errors for hidden and absent papers", async () => {
    const currentFixtures = fixtures!;
    const published = await guest.papers.detail({ id: currentFixtures.paperIds.published });
    expect(published.id).toBe(currentFixtures.paperIds.published);

    for (const status of ["pending", "needs_review", "rejected", "inactive"] as const) {
      await expectTrpcError(
        guest.papers.detail({ id: currentFixtures.paperIds[status] }),
        "NOT_FOUND",
        "Paper not found",
      );
    }

    await expectTrpcError(
      userA.papers.detail({ id: currentFixtures.paperIds.needs_review }),
      "NOT_FOUND",
      "Paper not found",
    );

    await expectTrpcError(guest.papers.detail({ id: crypto.randomUUID() }), "NOT_FOUND", "Paper not found");
  });

  test("category counts include only published papers", async () => {
    const currentFixtures = fixtures!;
    const categories = await guest.categories.list();
    const category = categories.find((item) => item.id === currentFixtures.categoryId);

    expect(category?.paperCount).toBe(1);
  });
});

describe("authentication and admin authorization", () => {
  test("guest private and admin calls are unauthorized", async () => {
    await expectTrpcError(guest.bookmark.list(), "UNAUTHORIZED");
    await expectTrpcError(guest.admin.dashboard.getOverview(), "UNAUTHORIZED");
  });

  test("normal users can use private procedures but cannot use admin procedures", async () => {
    const profile = await userA.profile.getOverview();
    expect(profile.user.id).toBe(fixtures!.userA.id);
    await expectTrpcError(userA.admin.dashboard.getOverview(), "FORBIDDEN");

    const adminCallWithForgedInput = userA.admin.dashboard.getOverview as unknown as (input: {
      userId: string;
      role: "admin";
    }) => ReturnType<typeof userA.admin.dashboard.getOverview>;
    await expectTrpcError(
      adminCallWithForgedInput({ userId: fixtures!.admin.id, role: "admin" }),
      "FORBIDDEN",
    );
  });

  test("the admin guard trusts the database role, not a mocked session role", async () => {
    const currentFixtures = fixtures!;
    const forgedAdmin = (await import("../../routers")).appRouter.createCaller(
      createUserContext({ ...currentFixtures.userA, role: "admin" }),
    );

    await expectTrpcError(forgedAdmin.admin.dashboard.getOverview(), "FORBIDDEN");
    const overview = await admin.admin.dashboard.getOverview();
    expect(overview.systemHealth.database.status).toBe("connected");

    await fixturePrisma.user.update({ where: { id: currentFixtures.admin.id }, data: { role: "user" } });
    try {
      await expectTrpcError(admin.admin.dashboard.getOverview(), "FORBIDDEN");
    } finally {
      await fixturePrisma.user.update({ where: { id: currentFixtures.admin.id }, data: { role: "admin" } });
    }
  });
});

describe("private ownership", () => {
  test("bookmarks are scoped to the session user", async () => {
    const currentFixtures = fixtures!;
    const [bookmarksA, bookmarksB, paperBookmarkB] = await Promise.all([
      userA.bookmark.list(),
      userB.bookmark.list(),
      userB.bookmark.getForPaper({ paperId: currentFixtures.paperIds.published }),
    ]);

    expect(bookmarksA.some((bookmark) => bookmark.id === currentFixtures.bookmarkId)).toBe(true);
    expect(bookmarksB.some((bookmark) => bookmark.id === currentFixtures.bookmarkId)).toBe(false);
    expect(paperBookmarkB.isBookmarked).toBe(false);

    const removal = await userB.bookmark.remove({ paperId: currentFixtures.paperIds.published });
    expect(removal.removed).toBe(false);
    expect(await fixturePrisma.bookmark.count({ where: { id: currentFixtures.bookmarkId } })).toBe(1);
  });

  test("notes cannot be read, updated, or deleted across users", async () => {
    const currentFixtures = fixtures!;
    const [notesA, notesB] = await Promise.all([
      userA.notes.listForPaper({ paperId: currentFixtures.paperIds.published }),
      userB.notes.listForPaper({ paperId: currentFixtures.paperIds.published }),
    ]);

    expect(notesA.some((note) => note.id === currentFixtures.noteId)).toBe(true);
    expect(notesB.some((note) => note.id === currentFixtures.noteId)).toBe(false);

    await expectTrpcError(
      userB.notes.update({ noteId: currentFixtures.noteId, note: "Unauthorized update attempt" }),
      "FORBIDDEN",
    );
    await expectTrpcError(userB.notes.delete({ noteId: currentFixtures.noteId }), "FORBIDDEN");
    expect(await fixturePrisma.readingNote.count({ where: { id: currentFixtures.noteId } })).toBe(1);
  });

  test("reading progress and profile queries use the session owner", async () => {
    const currentFixtures = fixtures!;
    const [progressA, progressB] = await Promise.all([
      userA.reading.getForPaper({ paperId: currentFixtures.paperIds.published }),
      userB.reading.getForPaper({ paperId: currentFixtures.paperIds.published }),
    ]);

    expect(progressA?.id).toBe(currentFixtures.progressId);
    expect(progressB).toBeNull();

    const profileWithForgedInput = await (
      userB.profile.getOverview as unknown as (input: { userId: string }) => ReturnType<typeof userB.profile.getOverview>
    )({ userId: currentFixtures.userA.id });
    expect(profileWithForgedInput.user.id).toBe(currentFixtures.userB.id);
  });
});
