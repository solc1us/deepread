import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER_DIRECTORY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DIST_DIRECTORY = path.join(SERVER_DIRECTORY, "dist");
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SMOKE_TIMEOUT_MS = 15_000;
const STANDALONE_STARTUP_TIMEOUT_MS = 10_000;
const SHUTDOWN_TIMEOUT_MS = 5_000;
const SERVER_ENTRYPOINT_PATTERN = /^(app|index|server)\.(?:[cm]?[jt]s)$/;
const FORBIDDEN_RUNTIME_IMPORTS = [
  /from\s+["']@deepread\//,
  /import\(\s*["']@deepread\//,
  /node_modules[\\/]@deepread[\\/].*src[\\/].*\.ts/,
  /@deepread\/.*\/src\/.*\.ts/,
];

async function assertSingleVercelEntrypoint() {
  const entrypoints = [];

  for (const directory of [SERVER_DIRECTORY, path.join(SERVER_DIRECTORY, "src")]) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && SERVER_ENTRYPOINT_PATTERN.test(entry.name)) {
        entrypoints.push(
          path
            .relative(SERVER_DIRECTORY, path.join(directory, entry.name))
            .replaceAll("\\", "/"),
        );
      }
    }
  }

  if (entrypoints.length !== 1 || entrypoints[0] !== "app.ts") {
    throw new Error(
      `Expected app.ts to be the only Vercel-detectable server entrypoint; found: ${
        entrypoints.join(", ") || "none"
      }.`,
    );
  }
}

async function assertRootEntrypointContract() {
  const source = await readFile(path.join(SERVER_DIRECTORY, "app.ts"), "utf8");
  const requiredPatterns = [
    {
      pattern: /import\s+express\s+from\s+["']express["']/,
      message: "The root app.ts must directly import express.",
    },
    {
      pattern: /import\s+app\s+from\s+["']\.\/vercel-entry\.js["']/,
      message: "The root app.ts must load the bundled app bridge.",
    },
    {
      pattern: /export\s+default\s+app\b/,
      message: "The root app.ts must default-export the bundled app.",
    },
  ];

  for (const { pattern, message } of requiredPatterns) {
    if (!pattern.test(source)) {
      throw new Error(message);
    }
  }

  if (/\bexpress\s*\(/.test(source)) {
    throw new Error("The root app.ts must not create another Express app.");
  }
  if (/\.listen\s*\(/.test(source)) {
    throw new Error("The root app.ts must not call listen.");
  }
  if (FORBIDDEN_RUNTIME_IMPORTS.some((pattern) => pattern.test(source))) {
    throw new Error("The root app.ts contains a raw workspace source import.");
  }
}

async function assertBundledRuntimeGraph() {
  const outputFiles = (await readdir(DIST_DIRECTORY))
    .filter((fileName) => fileName.endsWith(".mjs"))
    .sort();

  for (const requiredOutput of ["standalone.mjs", "vercel-app.mjs"]) {
    if (!outputFiles.includes(requiredOutput)) {
      throw new Error(`The ${requiredOutput} bundle was not generated.`);
    }
  }

  for (const fileName of outputFiles) {
    const output = await readFile(path.join(DIST_DIRECTORY, fileName), "utf8");
    if (FORBIDDEN_RUNTIME_IMPORTS.some((pattern) => pattern.test(output))) {
      throw new Error(`Uncompiled workspace source import found in ${fileName}.`);
    }
  }
}

async function runHealthProbe() {
  const { default: app } = await import("../../app.ts");
  const server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("The runtime smoke server did not expose a TCP address.");
  }

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/health`);
    const body = await response.json();

    if (response.status !== 200 || body.status !== "ok") {
      throw new Error("The bundled Vercel app did not serve the health endpoint.");
    }
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

async function runChild() {
  await runHealthProbe();
  console.log("[Vercel Runtime] Import and health probe passed.");
}

async function runParent() {
  await assertSingleVercelEntrypoint();
  await assertRootEntrypointContract();
  await assertBundledRuntimeGraph();

  const child = createServerSmokeProcess();
  const stdout = [];
  const stderr = [];
  child.stdout.on("data", (chunk) => stdout.push(chunk));
  child.stderr.on("data", (chunk) => stderr.push(chunk));

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill();
  }, SMOKE_TIMEOUT_MS);
  timeout.unref?.();

  const [exitCode] = await once(child, "exit");
  clearTimeout(timeout);

  if (timedOut || exitCode !== 0) {
    const errorOutput = Buffer.concat(stderr).toString("utf8");
    const message = errorOutput.trim().split(/\r?\n/).slice(-3).join(" ");
    throw new Error(
      message ||
        (timedOut
          ? `Node runtime smoke check exceeded ${SMOKE_TIMEOUT_MS}ms.`
          : `Node runtime smoke check exited with code ${exitCode}.`),
    );
  }

  process.stdout.write(Buffer.concat(stdout).toString("utf8"));
  await runStandaloneProbe();
  console.log("[Vercel Runtime] Only apps/server/app.ts is auto-detectable.");
  console.log("[Vercel Runtime] Bundle contains no raw @deepread TypeScript imports.");
}

function createServerSmokeProcess() {
  return spawn(process.execPath, [SCRIPT_PATH, "--child"], {
    cwd: path.resolve(SERVER_DIRECTORY, "../.."),
    env: createRuntimeEnvironment(),
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function createRuntimeEnvironment(overrides = {}) {
  return {
    ...process.env,
    DATABASE_URL:
      "postgresql://runtime_smoke:runtime_smoke@db.example.invalid:5432/deepread_runtime_smoke",
    BETTER_AUTH_SECRET: "runtime-smoke-secret-at-least-32-characters",
    BETTER_AUTH_URL: "https://web.example.invalid",
    CORS_ORIGIN: "https://web.example.invalid",
    NODE_ENV: "production",
    ...overrides,
  };
}

async function runStandaloneProbe() {
  const port = await getAvailablePort();
  const child = spawn(
    process.execPath,
    [path.join(DIST_DIRECTORY, "standalone.mjs")],
    {
      cwd: SERVER_DIRECTORY,
      env: createRuntimeEnvironment({ PORT: String(port) }),
      stdio: "ignore",
    },
  );

  try {
    await waitForHealth(port, child);
    console.log("[Vercel Runtime] Standalone startup probe passed.");
  } finally {
    await stopChild(child);
  }
}

async function getAvailablePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();

  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Could not reserve a port for the standalone smoke check.");
  }

  const { port } = address;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return port;
}

async function waitForHealth(port, child) {
  const deadline = Date.now() + STANDALONE_STARTUP_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("The standalone server exited before becoming healthy.");
    }

    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.status === 200) {
        return;
      }
    } catch {
      // The listener may not be ready yet.
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(
    `Standalone startup exceeded ${STANDALONE_STARTUP_TIMEOUT_MS}ms.`,
  );
}

async function stopChild(child) {
  if (child.exitCode !== null) {
    return;
  }

  const exit = once(child, "exit");
  child.kill("SIGTERM");
  const stopped = await Promise.race([
    exit.then(() => true),
    new Promise((resolve) =>
      setTimeout(() => resolve(false), SHUTDOWN_TIMEOUT_MS),
    ),
  ]);

  if (!stopped && child.exitCode === null) {
    child.kill("SIGKILL");
    await once(child, "exit");
  }
}

if (process.argv.includes("--child")) {
  await runChild();
} else {
  await runParent();
}
