import { signIn, signOut } from "./auth-helpers";
import { expect, test } from "./e2e-test";

test("reader persists a bookmark and completed reading progress", async ({
  page,
  e2eState,
}) => {
  await signIn(page, { email: e2eState.user.email, password: e2eState.password });
  await expect(page).toHaveURL(/\/profile$/);

  await page.goto(`/papers/${e2eState.primaryPaper.id}`);
  await page.getByRole("button", { name: "Bookmark", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Bookmark" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove Bookmark" })).toBeVisible();

  await page.getByRole("button", { name: "Start Reading" }).click();
  await expect(page.getByText("Reading Progress", { exact: true })).toBeVisible();
  await page.getByLabel("Reading progress percentage").fill("45");
  await page.getByRole("button", { name: "Save Progress" }).click();
  await expect(page.getByText("Reading progress saved")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Reading progress percentage")).toHaveValue("45");
  await page.getByRole("button", { name: "Mark Completed" }).click();
  await expect(page.getByText("Paper marked as completed")).toBeVisible();
  await expect(page.getByLabel("Reading progress percentage")).toHaveValue("100");
});

test("reader sees deterministic statistics and profile results", async ({ page, e2eState }) => {
  await signIn(page, { email: e2eState.user.email, password: e2eState.password });
  await page.goto("/statistics");
  await expect(page.getByText("Completed papers", { exact: true })).toBeVisible();
  await expect(page.getByText("Bookmarked papers", { exact: true })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
});

test("reader can create, update, and delete a private note", async ({ page, e2eState }) => {
  await signIn(page, { email: e2eState.user.email, password: e2eState.password });
  await page.goto(`/papers/${e2eState.primaryPaper.id}`);
  const originalNote = `E2E note ${e2eState.runId}`;
  const updatedNote = `${originalNote} updated`;
  await page.getByLabel("Note").fill(originalNote);
  await page.getByLabel("Section (optional)").fill("Discussion");
  await page.getByRole("button", { name: "Add Note" }).click();
  await expect(page.getByText(originalNote)).toBeVisible();
  await page.getByRole("button", { name: "Edit note" }).click();
  await page.locator("textarea:not([placeholder])").fill(updatedNote);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(updatedNote)).toBeVisible();
  await page.getByRole("button", { name: "Delete note" }).click();
  await expect(page.getByText(updatedNote)).toHaveCount(0);
});

test("reader cannot access admin pages and can sign out", async ({ page, e2eState }) => {
  await signIn(page, { email: e2eState.user.email, password: e2eState.password });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/papers$/);
  await expect(page.getByRole("heading", { name: "Find approachable papers" })).toBeVisible();
  await signOut(page);
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
});
