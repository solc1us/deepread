import path from "node:path";

import {
  formatTestDatabaseSummary,
  loadTestDatabaseEnvironment,
  TestDatabaseConfigurationError,
} from "../test-database-environment";

async function main() {
  const environment = loadTestDatabaseEnvironment({ requireDirectUrl: true });
  const databasePackageDirectory = path.resolve(import.meta.dir, "../..");

  console.log(`[Test Database Migration] ${formatTestDatabaseSummary(environment)}`);
  console.log("Applying existing migrations to the explicitly configured isolated test database.");

  const processHandle = Bun.spawn(
    ["bunx", "--bun", "prisma", "migrate", "deploy", "--config", "prisma.config.ts"],
    {
      cwd: databasePackageDirectory,
      env: {
        ...process.env,
        DIRECT_URL: environment.directUrl!,
      },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    },
  );

  process.exit(await processHandle.exited);
}

main().catch((error: unknown) => {
  const message =
    error instanceof TestDatabaseConfigurationError
      ? error.message
      : "Test database migration failed. Verify the isolated database configuration and migration output.";
  console.error(`[Test Database Guard] ${message}`);
  process.exit(1);
});
