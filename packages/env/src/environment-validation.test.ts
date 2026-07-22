import { describe, expect, test } from "bun:test";

import {
  getProductionWebOriginWarning,
  httpOriginSchema,
} from "./environment-validation";
import {
  postgresUrlSchema,
  validateServerProductionEnvironment,
} from "./server-environment-validation";

describe("environment validation", () => {
  test("normalizes exact HTTP origins and rejects paths", () => {
    expect(httpOriginSchema("API_URL").parse("https://api.example.com/")).toBe(
      "https://api.example.com",
    );
    expect(() => httpOriginSchema("API_URL").parse("https://api.example.com/trpc")).toThrow();
  });

  test("accepts PostgreSQL URLs and rejects unrelated protocols", () => {
    expect(postgresUrlSchema("DATABASE_URL").parse("postgresql://user:pass@db.example.com/app")).toBe(
      "postgresql://user:pass@db.example.com/app",
    );
    expect(() => postgresUrlSchema("DATABASE_URL").parse("https://db.example.com/app")).toThrow();
  });

  test("rejects local origins and placeholder secrets in production", () => {
    expect(() =>
      validateServerProductionEnvironment({
        nodeEnv: "production",
        databaseUrl: "postgresql://user:pass@db.example.com/app",
        authSecret: "replace-with-at-least-32-characters",
        authUrl: "https://api.example.com",
        corsOrigin: "https://www.example.com",
      }),
    ).toThrow("known placeholder");

    expect(() =>
      validateServerProductionEnvironment({
        nodeEnv: "production",
        databaseUrl: "postgresql://user:pass@localhost/app",
        authSecret: "a-secure-random-production-secret-value",
        authUrl: "https://api.example.com",
        corsOrigin: "https://www.example.com",
      }),
    ).toThrow("must not reference localhost");
  });

  test("allows local development and warns about local production web builds", () => {
    expect(() =>
      validateServerProductionEnvironment({
        nodeEnv: "development",
        databaseUrl: "postgresql://user:pass@localhost/app",
        authSecret: "replace-with-at-least-32-characters",
        authUrl: "http://localhost:3000",
        corsOrigin: "http://localhost:3001",
      }),
    ).not.toThrow();

    expect(
      getProductionWebOriginWarning({
        nodeEnv: "production",
        serverUrl: "http://localhost:3000",
      }),
    ).toContain("NEXT_PUBLIC_SERVER_URL");
  });
});
