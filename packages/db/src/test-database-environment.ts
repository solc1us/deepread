import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";

const TEST_DATABASE_CONFIRMATION = "deepread-test-only";
const TEST_ENV_PATH = path.resolve(import.meta.dir, "../../..", ".env.test.local");
const DEVELOPMENT_ENV_PATH = path.resolve(import.meta.dir, "../../..", "apps/server/.env");

export interface TestDatabaseEnvironment {
  databaseUrl: string;
  directUrl: string | null;
  summary: {
    host: string;
    database: string;
  };
}

let cachedEnvironment: TestDatabaseEnvironment | null = null;

export class TestDatabaseConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestDatabaseConfigurationError";
  }
}

function normalizedConnectionString(value: string) {
  return new URL(value).toString();
}

function requirePostgresUrl(name: string, value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    throw new TestDatabaseConfigurationError(`${name} is required for isolated database operations.`);
  }

  let url: URL;
  try {
    url = new URL(trimmedValue);
  } catch {
    throw new TestDatabaseConfigurationError(`${name} must be a valid PostgreSQL connection URL.`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new TestDatabaseConfigurationError(`${name} must use the postgres or postgresql protocol.`);
  }

  return trimmedValue;
}

function assertDifferentConnection(
  testName: string,
  testValue: string,
  regularName: string,
  regularValue: string | undefined,
) {
  if (!regularValue?.trim()) {
    return;
  }

  let matches = testValue.trim() === regularValue.trim();
  try {
    matches = normalizedConnectionString(testValue) === normalizedConnectionString(regularValue);
  } catch {
    // The regular application URL is validated by the application environment schema.
  }

  if (matches) {
    throw new TestDatabaseConfigurationError(
      `${testName} must not reference the same database as ${regularName}.`,
    );
  }
}

function summarizeConnection(connectionString: string) {
  const url = new URL(connectionString);
  const isLocal = ["127.0.0.1", "localhost", "::1"].includes(url.hostname.toLowerCase());
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres";

  if (isLocal) {
    return {
      host: url.hostname,
      database: databaseName,
    };
  }

  return {
    host: "remote PostgreSQL host",
    database: `sha256:${createHash("sha256").update(databaseName).digest("hex").slice(0, 8)}`,
  };
}

function loadDevelopmentEnvironmentForComparison() {
  try {
    return dotenv.parse(readFileSync(DEVELOPMENT_ENV_PATH));
  } catch {
    return {};
  }
}

export function loadTestDatabaseEnvironment(options: { requireDirectUrl?: boolean } = {}) {
  if (cachedEnvironment && (!options.requireDirectUrl || cachedEnvironment.directUrl)) {
    return cachedEnvironment;
  }

  dotenv.config({
    path: TEST_ENV_PATH,
    override: false,
    quiet: true,
  });

  if (process.env.DEEPREAD_TEST_DATABASE_CONFIRMATION !== TEST_DATABASE_CONFIRMATION) {
    throw new TestDatabaseConfigurationError(
      `DEEPREAD_TEST_DATABASE_CONFIRMATION must equal ${TEST_DATABASE_CONFIRMATION} before isolated database operations can run.`,
    );
  }

  const databaseUrl = requirePostgresUrl("TEST_DATABASE_URL", process.env.TEST_DATABASE_URL);
  const directUrl = process.env.TEST_DIRECT_URL?.trim()
    ? requirePostgresUrl("TEST_DIRECT_URL", process.env.TEST_DIRECT_URL)
    : null;

  if (options.requireDirectUrl && !directUrl) {
    throw new TestDatabaseConfigurationError("TEST_DIRECT_URL is required for the guarded migration command.");
  }

  const developmentEnvironment = loadDevelopmentEnvironmentForComparison();
  const regularDatabaseUrl = process.env.DATABASE_URL ?? developmentEnvironment.DATABASE_URL;
  const regularDirectUrl = process.env.DIRECT_URL ?? developmentEnvironment.DIRECT_URL;

  assertDifferentConnection("TEST_DATABASE_URL", databaseUrl, "DATABASE_URL", regularDatabaseUrl);
  assertDifferentConnection("TEST_DATABASE_URL", databaseUrl, "DIRECT_URL", regularDirectUrl);

  if (directUrl) {
    assertDifferentConnection("TEST_DIRECT_URL", directUrl, "DIRECT_URL", regularDirectUrl);
    assertDifferentConnection("TEST_DIRECT_URL", directUrl, "DATABASE_URL", regularDatabaseUrl);
  }

  cachedEnvironment = {
    databaseUrl,
    directUrl,
    summary: summarizeConnection(databaseUrl),
  };

  return cachedEnvironment;
}

export function formatTestDatabaseSummary(environment: TestDatabaseEnvironment) {
  return `host=${environment.summary.host}, database=${environment.summary.database}`;
}
