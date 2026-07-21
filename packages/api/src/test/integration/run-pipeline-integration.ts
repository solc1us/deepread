import path from "node:path";

import {
  loadTestDatabaseEnvironment,
  TestDatabaseConfigurationError,
} from "@deepread/db/test-database-environment";

async function main() {
  loadTestDatabaseEnvironment();

  const rootDirectory = path.resolve(import.meta.dir, "../../../../..");
  const processHandle = Bun.spawn(
    [
      process.execPath,
      "test",
      "--preload",
      "./packages/api/src/test/integration/preload.ts",
      "./packages/api/src/test/integration/pipeline-remediation.integration.ts",
    ],
    {
      cwd: rootDirectory,
      env: process.env,
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
      : "Pipeline integration tests could not start with the isolated test database.";
  console.error(`[Test Database Guard] ${message}`);
  process.exit(1);
});
