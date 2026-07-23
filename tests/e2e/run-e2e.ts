import type { Server } from "node:http";
import path from "node:path";

import { getE2EEnvironment } from "./e2e-environment";
import { cleanupE2EFixtures, createE2EFixtures } from "./e2e-fixtures";

const STARTUP_TIMEOUT_MS = 60_000;
const PLAYWRIGHT_TIMEOUT_MS = 360_000;
const FIXTURE_TIMEOUT_MS = 30_000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

type ManagedProcess = Bun.Subprocess<
	"ignore" | "inherit",
	"ignore" | "inherit",
	"ignore" | "inherit"
>;

function timeoutAfter(timeoutMs: number, message: string) {
	let timeout: ReturnType<typeof setTimeout>;
	const promise = new Promise<never>((_, reject) => {
		timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
		timeout.unref?.();
	});
	return { promise, cancel: () => clearTimeout(timeout) };
}

async function withTimeout<T>(
	promise: Promise<T>,
	timeoutMs: number,
	message: string,
) {
	const timeout = timeoutAfter(timeoutMs, message);
	try {
		return await Promise.race([promise, timeout.promise]);
	} finally {
		timeout.cancel();
	}
}

async function waitForUrl(url: string, childProcess?: ManagedProcess) {
	const deadline = Date.now() + STARTUP_TIMEOUT_MS;

	while (Date.now() < deadline) {
		if (
			childProcess?.exitCode !== null &&
			childProcess?.exitCode !== undefined
		) {
			throw new Error(`Local E2E process exited before ${url} became ready.`);
		}

		try {
			const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
			if (response.ok) return;
		} catch {
			// The local process is still starting.
		}
		await Bun.sleep(250);
	}

  throw new Error(`Timed out waiting for local E2E service at ${url}.`);
}

async function warmWebRoutes(
  webOrigin: string,
  state: Awaited<ReturnType<typeof createE2EFixtures>>,
) {
  const routes = [
    "/login",
    "/papers",
    `/papers/${state.primaryPaper.id}`,
    `/papers/${state.primaryPaper.id}/read`,
    "/profile",
    "/statistics",
    "/admin",
    "/admin/papers",
    `/admin/papers/${state.needsReviewPaper.id}`,
    "/admin/data-quality",
    "/admin/data-quality/details?issue=duplicate-title",
  ];

  for (const route of routes) {
    const response = await fetch(`${webOrigin}${route}`, {
      signal: AbortSignal.timeout(STARTUP_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Local E2E route failed to warm: ${route}.`);
    }
  }
}

async function stopProcessTree(childProcess: ManagedProcess) {
	if (childProcess.exitCode !== null) return;

	if (process.platform === "win32") {
		const taskkill = Bun.spawn(
			["taskkill", "/PID", String(childProcess.pid), "/T", "/F"],
			{ stdout: "ignore", stderr: "ignore" },
		);
		await withTimeout(
			taskkill.exited.then(() => undefined),
			SHUTDOWN_TIMEOUT_MS,
			"Timed out terminating a local E2E process tree.",
		).catch(() => undefined);
		await withTimeout(
			childProcess.exited.then(() => undefined),
			1_000,
			"Timed out observing the terminated local E2E process.",
		).catch(() => undefined);
		return;
	}

	childProcess.kill("SIGTERM");
	const stopped = await withTimeout(
		childProcess.exited.then(() => true),
		SHUTDOWN_TIMEOUT_MS,
		"Timed out stopping a local E2E process.",
	).catch(() => false);
	if (!stopped && childProcess.exitCode === null) {
		childProcess.kill("SIGKILL");
		await withTimeout(
			childProcess.exited.then(() => undefined),
			1_000,
			"Timed out observing the killed local E2E process.",
		).catch(() => undefined);
	}
}

async function closeServer(server: Server) {
	const closed = new Promise<void>((resolve, reject) => {
		server.close((error) => (error ? reject(error) : resolve()));
		server.closeIdleConnections?.();
	});

	try {
		await withTimeout(
			closed,
			SHUTDOWN_TIMEOUT_MS,
			"Timed out closing the E2E API server.",
		);
	} catch {
		server.closeAllConnections?.();
		await withTimeout(
			closed.catch(() => undefined),
			1_000,
			"Timed out forcing the E2E API server closed.",
		).catch(() => undefined);
	}
}

const environment = getE2EEnvironment();
console.info("[E2E] Test database guard passed.");
const inheritedEnvironment = Object.fromEntries(
	Object.entries(process.env).flatMap(([key, value]) =>
		value === undefined ? [] : [[key, value]],
	),
);
Object.assign(process.env, environment.serverEnvironment);

let server: Server | null = null;
let prisma: { $disconnect(): Promise<void> } | null = null;
let web: ManagedProcess | null = null;
let playwright: ManagedProcess | null = null;
let fixturesStarted = false;
let cleanupPromise: Promise<void> | null = null;
let interrupted = false;

async function cleanup() {
	cleanupPromise ??= (async () => {
		if (playwright) await stopProcessTree(playwright);

		if (fixturesStarted) {
			try {
				await withTimeout(
					cleanupE2EFixtures(),
					FIXTURE_TIMEOUT_MS,
					"Timed out cleaning isolated E2E fixtures.",
				);
				console.info("[E2E] Fixtures cleaned.");
			} catch (error) {
				console.error("[E2E] Fixture cleanup failed.", {
					errorType: error instanceof Error ? error.name : typeof error,
				});
			}
		}

		if (web) await stopProcessTree(web);
		if (server) await closeServer(server);
		if (prisma) {
			await withTimeout(
				prisma.$disconnect(),
				SHUTDOWN_TIMEOUT_MS,
				"Timed out disconnecting the E2E API database client.",
			).catch(() => undefined);
		}
		console.info("[E2E] Servers stopped.");
	})();
	return cleanupPromise;
}

function handleSignal(signal: "SIGINT" | "SIGTERM") {
	if (interrupted) return;
	interrupted = true;
	console.info(`[E2E] ${signal} received; stopping local test resources.`);
	void cleanup().finally(() => process.exit(130));
}

process.once("SIGINT", () => handleSignal("SIGINT"));
process.once("SIGTERM", () => handleSignal("SIGTERM"));

let exitCode = 1;
try {
	const [{ default: app }, databaseModule] = await Promise.all([
		import("../../apps/server/src/express-app.ts"),
		import("../../packages/db/src/index.ts"),
	]);
	prisma = databaseModule.default;
	server = await new Promise<Server>((resolve, reject) => {
		const instance = app.listen(3002, "127.0.0.1", () => resolve(instance));
		instance.once("error", reject);
	});
	await waitForUrl(`${environment.serverOrigin}/ready`);
	console.info("[E2E] API started.");

	web = Bun.spawn(
		[
			process.execPath,
			"node_modules/next/dist/bin/next",
			"dev",
			"--webpack",
			"--hostname",
			"127.0.0.1",
			"--port",
			"3001",
		],
		{
			cwd: path.resolve(process.cwd(), "apps/web"),
			env: {
				...inheritedEnvironment,
				...environment.webEnvironment,
				NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.resolve(
					process.cwd(),
					"tests/e2e/font-mocks.cjs",
				),
			},
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	await waitForUrl(environment.webOrigin, web);
	console.info("[E2E] Web started.");

	fixturesStarted = true;
	const e2eState = await withTimeout(
		createE2EFixtures(),
		FIXTURE_TIMEOUT_MS,
		"Timed out seeding isolated E2E fixtures.",
	);
	console.info("[E2E] Fixtures seeded.");
	await withTimeout(
		warmWebRoutes(environment.webOrigin, e2eState),
		STARTUP_TIMEOUT_MS,
		"Timed out warming local E2E routes.",
	);
	console.info("[E2E] Routes warmed.");

	console.info("[E2E] Playwright started.");
	playwright = Bun.spawn(
		[
			"node",
			"node_modules/@playwright/test/cli.js",
			"test",
			...process.argv.slice(2),
		],
		{
			cwd: process.cwd(),
			env: inheritedEnvironment,
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	exitCode = await withTimeout(
		playwright.exited,
		PLAYWRIGHT_TIMEOUT_MS,
		"Playwright exceeded the bounded E2E execution timeout.",
	);
	console.info(`[E2E] Playwright completed with exit code ${exitCode}.`);
} catch (error) {
	console.error("[E2E] Local run failed.", {
		message:
			error instanceof Error ? error.message : "Unknown E2E runner failure.",
	});
} finally {
	await cleanup();
}

if (!interrupted) process.exit(exitCode);
