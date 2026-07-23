import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { httpOriginSchema } from "./environment-validation";
import {
  postgresUrlSchema,
  validateServerProductionEnvironment,
} from "./server-environment-validation";

const serverSchema = {
  DATABASE_URL: postgresUrlSchema("DATABASE_URL"),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: httpOriginSchema("BETTER_AUTH_URL"),
  CORS_ORIGIN: httpOriginSchema("CORS_ORIGIN"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  ADMIN_EMAIL: z.email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NAME: z.string().min(1).optional(),
  OPENALEX_API_KEY: z.string().optional(),
  OPENALEX_BASE_URL: httpOriginSchema("OPENALEX_BASE_URL").default("https://api.openalex.org"),
  CLASSIFICATION_PROFILING: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  OPENALEX_INGESTION_PROFILING: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
};

export const env = createEnv<undefined, typeof serverSchema>({
  server: serverSchema,
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

validateServerProductionEnvironment({
  nodeEnv: env.NODE_ENV,
  databaseUrl: env.DATABASE_URL,
  authSecret: env.BETTER_AUTH_SECRET,
  authUrl: env.BETTER_AUTH_URL,
  corsOrigin: env.CORS_ORIGIN,
});
