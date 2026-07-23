import type { Page } from "@playwright/test";

export async function signIn(page: Page, credentials: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Already have an account? Sign In" }).click();
  await page.getByLabel("Email").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.locator("form").getByRole("button", { name: "Sign In", exact: true }).click();
  await page.waitForURL(/\/(profile|admin)$/, { timeout: 30_000 });
}

export async function signOut(page: Page) {
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/auth/sign-out") && response.ok(),
    ),
    page.getByRole("button", { name: "Logout", exact: true }).click(),
  ]);
  await page.waitForURL(/\/$/, { timeout: 30_000 });
}
