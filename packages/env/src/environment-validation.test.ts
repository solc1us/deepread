import { describe, expect, test } from "bun:test";

import {
  httpOriginSchema,
  validateProductionWebProxy,
  validateProductionWebOrigin,
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
        authUrl: "https://www.example.com",
        corsOrigin: "https://www.example.com",
      }),
    ).toThrow("known placeholder");

    expect(() =>
      validateServerProductionEnvironment({
        nodeEnv: "production",
        databaseUrl: "postgresql://user:pass@localhost/app",
        authSecret: "a-secure-random-production-secret-value",
        authUrl: "https://www.example.com",
        corsOrigin: "https://www.example.com",
      }),
    ).toThrow("must not reference localhost");

    expect(() =>
      validateServerProductionEnvironment({
        nodeEnv: "production",
        databaseUrl: "postgresql://user:pass@db.example.com/app",
        authSecret: "a-secure-random-production-secret-value",
        authUrl: "https://api.example.com",
        corsOrigin: "https://www.example.com",
      }),
    ).toThrow("same public web origin");
  });

  test("allows local development and rejects local production web builds", () => {
    expect(() =>
      validateServerProductionEnvironment({
        nodeEnv: "development",
        databaseUrl: "postgresql://user:pass@localhost/app",
        authSecret: "replace-with-at-least-32-characters",
        authUrl: "http://localhost:3000",
        corsOrigin: "http://localhost:3001",
      }),
    ).not.toThrow();

    expect(() =>
      validateProductionWebOrigin({
        nodeEnv: "production",
        serverUrl: "http://localhost:3000",
      }),
    ).toThrow("explicit HTTPS non-local web origin");

    expect(() =>
      validateProductionWebOrigin({
        nodeEnv: "production",
        serverUrl: "https://api.example.invalid",
      }),
    ).not.toThrow();
  });

  test("requires a distinct secure API upstream for production web proxies", () => {
    expect(() =>
      validateProductionWebProxy({
        nodeEnv: "production",
        publicWebOrigin: "https://web.example.com",
        apiUpstreamUrl: "http://localhost:3000",
      }),
    ).toThrow("explicit HTTPS non-local API origin");

    expect(() =>
      validateProductionWebProxy({
        nodeEnv: "production",
        publicWebOrigin: "https://web.example.com",
        apiUpstreamUrl: "https://web.example.com",
      }),
    ).toThrow("prevent a proxy loop");

    expect(() =>
      validateProductionWebProxy({
        nodeEnv: "production",
        publicWebOrigin: "https://web.example.com",
        apiUpstreamUrl: "https://api.example.com",
      }),
    ).not.toThrow();
  });
});
