import path from "node:path";

import dotenv from "dotenv";
import { Client } from "pg";

import {
  DatabaseTargetConfigurationError,
  type DatabaseOperation,
  formatDatabaseTargetSummary,
  resolveDatabaseTarget,
} from "../database-target";

const DATABASE_PACKAGE_DIRECTORY = path.resolve(import.meta.dir, "../..");
const SERVER_ENV_PATH = path.resolve(DATABASE_PACKAGE_DIRECTORY, "../../apps/server/.env");
const SUPPORTED_OPERATIONS = new Set<DatabaseOperation>(["status", "dev", "deploy", "smoke"]);

dotenv.config({
  path: SERVER_ENV_PATH,
  override: false,
  quiet: true,
});

function parseOperation(value: string | undefined): DatabaseOperation {
  if (!value || !SUPPORTED_OPERATIONS.has(value as DatabaseOperation)) {
    throw new DatabaseTargetConfigurationError(
      "Database operation must be one of: status, dev, deploy, smoke.",
    );
  }
  return value as DatabaseOperation;
}

async function runPrisma(operation: Exclude<DatabaseOperation, "smoke">, directUrl: string) {
  const prismaArguments =
    operation === "status"
      ? ["migrate", "status"]
      : operation === "dev"
        ? ["migrate", "dev"]
        : ["migrate", "deploy"];

  const processHandle = Bun.spawn(
    ["bunx", "--bun", "prisma", ...prismaArguments, "--config", "prisma.config.ts"],
    {
      cwd: DATABASE_PACKAGE_DIRECTORY,
      env: {
        ...process.env,
        DIRECT_URL: directUrl,
      },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  const exitCode = await processHandle.exited;
  if (exitCode !== 0) {
    throw new Error(`Prisma ${prismaArguments.join(" ")} exited with code ${exitCode}.`);
  }
}

async function runSmokeCheck(directUrl: string) {
  const client = new Client({
    connectionString: directUrl,
    connectionTimeoutMillis: 5_000,
  });

  try {
    await client.connect();
    await client.query("SELECT 1");
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const operation = parseOperation(process.argv[2]);
  const target = resolveDatabaseTarget({
    directUrl: process.env.DIRECT_URL,
    runtimeUrl: process.env.DATABASE_URL,
    requestedTarget: process.env.DEEPREAD_DATABASE_TARGET,
    productionConfirmation: process.env.DEEPREAD_PRODUCTION_MIGRATION_CONFIRMATION,
    operation,
  });

  console.log(`[Database Target] ${formatDatabaseTargetSummary(target)}`);

  if (operation === "smoke") {
    await runSmokeCheck(target.directUrl);
    console.log("[Database Smoke] Connection and lightweight query succeeded.");
    return;
  }

  await runPrisma(operation, target.directUrl);
}

main().catch((error: unknown) => {
  const message =
    error instanceof DatabaseTargetConfigurationError
      ? error.message
      : "Database command failed. Review the sanitized Prisma output and target configuration.";
  console.error(`[Database Command] ${message}`);
  process.exitCode = 1;
});
