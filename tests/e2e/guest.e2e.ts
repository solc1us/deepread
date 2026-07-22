import { expect, test } from "./e2e-test";

test("guest can browse, filter, paginate, and open a published paper", async ({
  page,
  e2eState,
}) => {
  await page.goto("/papers");
  await expect(page.getByRole("heading", { name: "Find approachable papers" })).toBeVisible();

  await page.getByLabel("Search").fill(`E2E ${e2eState.runId} Accessible Research`);
  await expect(
    page.getByLabel("Category").locator("option", { hasText: e2eState.category.name }),
  ).toHaveCount(1);
  await page.getByLabel("Category").selectOption({ label: e2eState.category.name });
  await page.getByLabel("Difficulty").selectOption("moderate");
  await page.getByLabel("Sort").selectOption("title");
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("papers.list") && response.ok()),
    page.getByRole("button", { name: "Filter" }).click(),
  ]);

  await expect(page.getByText(e2eState.primaryPaper.title, { exact: true })).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("papers.list") && response.ok()),
    page.getByRole("button", { name: "Next", exact: true }).click(),
  ]);
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByLabel("Search")).toHaveValue(`E2E ${e2eState.runId} Accessible Research`);
  await expect(page.getByLabel("Category")).toHaveValue(e2eState.category.id);
  await expect(page.getByLabel("Difficulty")).toHaveValue("moderate");
  await expect(page.getByLabel("Sort")).toHaveValue("title");

  await page.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  const openedPaperTitle = await page
    .getByText(new RegExp(`^E2E ${e2eState.runId} Accessible Research \\d+$`))
    .first()
    .textContent();
  await page.getByRole("link", { name: "View details", exact: true }).first().click();
  await expect(page).toHaveURL(/\/papers\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: openedPaperTitle ?? "" })).toBeVisible({
    timeout: 30_000,
  });
});

test("guest cannot open an unpublished paper", async ({ page, e2eState }) => {
  await page.goto(`/papers/${e2eState.unpublishedPaper.id}`);
  await expect(page.getByRole("main").getByText("Paper not found")).toBeVisible();
});

test("guest is redirected from authenticated and admin pages", async ({ page }) => {
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/, { timeout: 20_000 });
});
