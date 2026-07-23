import { describe, expect, test } from "bun:test";

import {
  DatabaseTargetConfigurationError,
  formatDatabaseTargetSummary,
  PRODUCTION_MIGRATION_CONFIRMATION,
  resolveDatabaseTarget,
} from "./database-target";

const localDirectUrl = "postgresql://local_user:local_password@localhost:5432/deepread";
const remoteDirectUrl =
  "postgresql://postgres:direct_password@db.production-ref.supabase.co:5432/postgres";
const remoteRuntimeUrl =
  "postgresql://postgres.production-ref:pool_password@pooler.supabase.com:6543/postgres";

describe("database target guard", () => {
  test("defaults an unambiguous local target without exposing credentials", () => {
    const target = resolveDatabaseTarget({
      directUrl: localDirectUrl,
      operation: "status",
    });
    const summary = formatDatabaseTargetSummary(target);

    expect(target.target).toBe("local");
    expect(summary).toContain("host=localhost");
    expect(summary).toContain("database=deepread");
    expect(summary).not.toContain("local_user");
    expect(summary).not.toContain("local_password");
  });

  test("rejects a remote target without explicit classification", () => {
    expect(() =>
      resolveDatabaseTarget({
        directUrl: remoteDirectUrl,
        operation: "status",
      }),
    ).toThrow(DatabaseTargetConfigurationError);
  });

  test("allows remote development only when explicitly classified", () => {
    const target = resolveDatabaseTarget({
      directUrl: remoteDirectUrl,
      runtimeUrl: remoteRuntimeUrl,
      requestedTarget: "development",
      operation: "dev",
    });

    expect(target.target).toBe("development");
    expect(target.summary.location).toBe("remote");
  });

  test("requires target-specific production confirmation and matching URLs", () => {
    expect(() =>
      resolveDatabaseTarget({
        directUrl: remoteDirectUrl,
        runtimeUrl: remoteRuntimeUrl,
        requestedTarget: "production",
        operation: "deploy",
      }),
    ).toThrow("DEEPREAD_PRODUCTION_MIGRATION_CONFIRMATION");

    expect(
      resolveDatabaseTarget({
        directUrl: remoteDirectUrl,
        runtimeUrl: remoteRuntimeUrl,
        requestedTarget: "production",
        operation: "deploy",
        productionConfirmation: PRODUCTION_MIGRATION_CONFIRMATION,
      }).target,
    ).toBe("production");
  });

  test("rejects production deployment to local and mismatched database targets", () => {
    expect(() =>
      resolveDatabaseTarget({
        directUrl: localDirectUrl,
        runtimeUrl: localDirectUrl,
        requestedTarget: "production",
        operation: "deploy",
        productionConfirmation: PRODUCTION_MIGRATION_CONFIRMATION,
      }),
    ).toThrow("explicit remote target");

    expect(() =>
      resolveDatabaseTarget({
        directUrl: remoteDirectUrl,
        runtimeUrl:
          "postgresql://postgres.other-ref:password@pooler.supabase.com:6543/another_database",
        requestedTarget: "production",
        operation: "deploy",
        productionConfirmation: PRODUCTION_MIGRATION_CONFIRMATION,
      }),
    ).toThrow("same database name");
  });
});
