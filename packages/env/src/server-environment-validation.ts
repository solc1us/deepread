import { z } from "zod";

const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1"]);
const INSECURE_SECRET_MARKERS = [
  "change-me",
  "ci-only",
  "development",
  "placeholder",
  "replace-with",
  "test-only",
];

export function postgresUrlSchema(name: string) {
  return z
    .string()
    .trim()
    .min(1)
    .superRefine((value, context) => {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        context.addIssue({ code: "custom", message: `${name} must be a valid PostgreSQL URL.` });
        return;
      }

      if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
        context.addIssue({
          code: "custom",
          message: `${name} must use the postgres or postgresql protocol.`,
        });
      }
    });
}

function isLocalUrl(value: string) {
  return LOCAL_HOSTNAMES.has(new URL(value).hostname.toLowerCase());
}

function assertSecureProductionOrigin(name: string, value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || isLocalUrl(value)) {
    throw new Error(`[Environment] ${name} must be an explicit HTTPS non-local origin in production.`);
  }
}

export function validateServerProductionEnvironment(input: {
  nodeEnv: "development" | "production" | "test";
  databaseUrl: string;
  authSecret: string;
  authUrl: string;
  corsOrigin: string;
}) {
  if (input.nodeEnv !== "production") return;

  assertSecureProductionOrigin("BETTER_AUTH_URL", input.authUrl);
  assertSecureProductionOrigin("CORS_ORIGIN", input.corsOrigin);
  if (isLocalUrl(input.databaseUrl)) {
    throw new Error("[Environment] DATABASE_URL must not reference localhost in production.");
  }

  const normalizedSecret = input.authSecret.toLowerCase();
  if (INSECURE_SECRET_MARKERS.some((marker) => normalizedSecret.includes(marker))) {
    throw new Error("[Environment] BETTER_AUTH_SECRET uses a known placeholder value in production.");
  }
}
