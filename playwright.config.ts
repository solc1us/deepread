import { defineConfig, devices } from "@playwright/test";

import { getE2EEnvironment } from "./tests/e2e/e2e-environment";

const environment = getE2EEnvironment();

export default defineConfig({
	testDir: "./tests/e2e",
	testMatch: "**/*.e2e.ts",
	fullyParallel: false,
	workers: 1,
	timeout: 60_000,
	globalTimeout: 300_000,
	expect: { timeout: 10_000 },
	forbidOnly: true,
	retries: 0,
	reporter: "line",
	outputDir: "tmp/playwright-results",
	use: {
		baseURL: environment.webOrigin,
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
