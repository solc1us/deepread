import { signIn } from "./auth-helpers";
import { expect, test } from "./e2e-test";

test("admin remediates a review paper and records a keep-both duplicate decision", async ({
  page,
  e2eState,
}) => {
  await signIn(page, { email: e2eState.admin.email, password: e2eState.password });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin Overview" })).toBeVisible();

  await page.getByRole("link", { name: "Papers Monitor" }).first().click();
  await page.waitForURL(/\/admin\/papers/);
  await expect(page.getByRole("heading", { name: "Papers Monitor" })).toBeVisible();
  await page.getByLabel("Status").selectOption("needs_review");
  await expect(page.getByRole("link", { name: e2eState.needsReviewPaper.title })).toBeVisible();
  await page.getByRole("link", { name: e2eState.needsReviewPaper.title }).click();
  await expect(page.getByRole("heading", { name: e2eState.needsReviewPaper.title })).toBeVisible();
  await expect(page.getByText("Review reasons", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit metadata" }).click();
  await page.getByRole("textbox", { name: "Author 1", exact: true }).fill("Updated Review Author");
  await page.getByRole("button", { name: "Save metadata" }).click();
  await expect(page.getByText("Paper metadata updated")).toBeVisible();

  await page.getByRole("button", { name: "Manual classify" }).click();
  await page.getByLabel("Difficulty").selectOption("moderate");
  await page
    .getByLabel("Review reason")
    .fill("E2E admin review confirms this paper is suitable for moderate readers.");
  await page.getByRole("button", { name: "Confirm and publish" }).click();
  await expect(page.getByText("Manual admin classification", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Data Quality" }).click();
  await expect(page.getByRole("heading", { name: "Data Quality" })).toBeVisible();
  await page.getByRole("link", { name: "Review groups" }).click();
  await expect(page.getByText(e2eState.duplicateTitle).first()).toBeVisible();
  await page.getByRole("button", { name: "Keep both" }).click();
  await page
    .getByLabel("Review reason")
    .fill("E2E review confirms these matching titles represent distinct paper records.");
  await page.getByRole("button", { name: "Confirm keep both" }).click();
  await expect(page.getByText("No probable duplicate-title groups were found.")).toBeVisible();
});
