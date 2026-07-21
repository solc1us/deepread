import path from "node:path";

import {
  loadTestDatabaseEnvironment,
  TestDatabaseConfigurationError,
} from "@deepread/db/test-database-environment";

async function main() {
  loadTestDatabaseEnvironment();

  const rootDirectory = path.resolve(import.meta.dir, "../../../../..");
  const testFiles = [
    "./packages/api/src/test/integration/pipeline-remediation.integration.ts",
    "./apps/server/src/server-runtime.integration.ts",
  ];

  for (const testFile of testFiles) {
    const processHandle = Bun.spawn(
      [
        process.execPath,
        "test",
        "--preload",
        "./packages/api/src/test/integration/preload.ts",
        testFile,
      ],
      {
        cwd: rootDirectory,
        env: process.env,
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      },
    );

    const exitCode = await processHandle.exited;
    if (exitCode !== 0) {
      process.exit(exitCode);
    }
  }
}

main().catch((error: unknown) => {
  const message =
    error instanceof TestDatabaseConfigurationError
      ? error.message
      : "Pipeline integration tests could not start with the isolated test database.";
  console.error(`[Test Database Guard] ${message}`);
  process.exit(1);
});
