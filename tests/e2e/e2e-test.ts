import { expect, test as base } from "@playwright/test";

import { getE2EEnvironment } from "./e2e-environment";
import { readE2EState } from "./e2e-fixtures";
import type { E2EState } from "./e2e-state";

type E2EFixtures = {
  e2eState: E2EState;
};

function isAllowedBrowserUrl(value: string, allowedOrigins: Set<string>) {
  if (/^(about:|blob:|data:)/.test(value)) return true;

  try {
    const url = new URL(value);
    const protocol = url.protocol === "ws:" ? "http:" : url.protocol === "wss:" ? "https:" : url.protocol;
    return allowedOrigins.has(`${protocol}//${url.host}`);
  } catch {
    return false;
  }
}

export const test = base.extend<E2EFixtures>({
  e2eState: async ({}, use) => {
    await use(await readE2EState());
  },
  page: async ({ page }, use) => {
    const environment = getE2EEnvironment();
    const allowedOrigins = new Set([environment.webOrigin]);
    const blockedUrls: string[] = [];

    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (isAllowedBrowserUrl(url, allowedOrigins)) {
        await route.continue();
        return;
      }

      blockedUrls.push(new URL(url).origin);
      await route.abort("blockedbyclient");
    });
    page.on("websocket", (socket) => {
      if (!isAllowedBrowserUrl(socket.url(), allowedOrigins)) {
        blockedUrls.push(new URL(socket.url()).origin);
      }
    });

    await use(page);
    expect(blockedUrls, `Unexpected external browser requests: ${blockedUrls.join(", ")}`).toEqual([]);
  },
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus) return;

  const currentUrl = new URL(page.url());
  console.error("[E2E] Test failed.", {
    test: testInfo.title,
    currentUrl: `${currentUrl.origin}${currentUrl.pathname}`,
  });
});

export { expect };
