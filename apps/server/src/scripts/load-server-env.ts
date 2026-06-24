import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const serverEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));

export function loadServerEnv() {
  if (!existsSync(serverEnvPath)) {
    return {
      ok: false,
      envPath: serverEnvPath,
      missing: ["apps/server/.env"],
      hasDirectUrl: false,
    };
  }

  const result = config({
    path: serverEnvPath,
    override: true,
  });

  const missing = ["DATABASE_URL"].filter((key) => !process.env[key]);

  return {
    ok: !result.error && missing.length === 0,
    envPath: serverEnvPath,
    missing,
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
    error: result.error,
  };
}

export function getScriptErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : null;
  const details: string[] = code ? [`${error.name}: ${code}`] : [`${error.name}: ${error.message}`];

  if (code === "Unknown system error -138") {
    details.push("The database query reached Prisma, but the configured database connection failed.");
    details.push("Check that apps/server/.env DATABASE_URL points to a reachable database host.");
  } else if (code) {
    details.push(error.message.trim() || "Prisma query failed.");
  }

  if ("meta" in error) {
    details.push(`meta: ${JSON.stringify(error.meta)}`);
  }

  if ("cause" in error && error.cause) {
    details.push(`cause: ${String(error.cause)}`);
  }

  return details.join("\n");
}
