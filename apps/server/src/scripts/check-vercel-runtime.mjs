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
const FORBIDDEN_RUNTIME_IMPORTS = [
  /from\s+["']@deepread\//,
  /import\(\s*["']@deepread\//,
  /node_modules[\\/]@deepread[\\/].*src[\\/].*\.ts/,
  /@deepread\/.*\/src\/.*\.ts/,
];

async function assertBundledRuntimeGraph() {
  const outputFiles = (await readdir(DIST_DIRECTORY))
    .filter((fileName) => fileName.endsWith(".mjs"))
    .sort();

  if (!outputFiles.includes("vercel-app.mjs")) {
    throw new Error("The Vercel app bundle was not generated.");
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
  console.log("[Vercel Runtime] Bundle contains no raw @deepread TypeScript imports.");
}

function createServerSmokeProcess() {
  return spawn(process.execPath, [SCRIPT_PATH, "--child"], {
    cwd: path.resolve(SERVER_DIRECTORY, "../.."),
    env: {
      ...process.env,
      DATABASE_URL:
        "postgresql://runtime_smoke:runtime_smoke@db.example.invalid:5432/deepread_runtime_smoke",
      BETTER_AUTH_SECRET: "runtime-smoke-secret-at-least-32-characters",
      BETTER_AUTH_URL: "https://api.example.invalid",
      CORS_ORIGIN: "https://web.example.invalid",
      NODE_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
}

if (process.argv.includes("--child")) {
  await runChild();
} else {
  await runParent();
}
