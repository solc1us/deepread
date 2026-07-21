import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    ADMIN_EMAIL: z.email().optional(),
    ADMIN_PASSWORD: z.string().min(8).optional(),
    ADMIN_NAME: z.string().min(1).optional(),
    OPENALEX_API_KEY: z.string().optional(),
    OPENALEX_BASE_URL: z.url().default("https://api.openalex.org"),
    CLASSIFICATION_PROFILING: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    OPENALEX_INGESTION_PROFILING: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
