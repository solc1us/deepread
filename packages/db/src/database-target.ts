export const DATABASE_TARGETS = [
  "local",
  "development",
  "preview",
  "production",
] as const;

export const PRODUCTION_MIGRATION_CONFIRMATION = "deploy-deepread-production";

export type DatabaseTarget = (typeof DATABASE_TARGETS)[number];
export type DatabaseOperation = "status" | "dev" | "deploy" | "smoke";

export interface ResolvedDatabaseTarget {
  directUrl: string;
  runtimeUrl: string | null;
  target: DatabaseTarget;
  summary: {
    host: string;
    database: string;
    location: "local" | "remote";
  };
}

export class DatabaseTargetConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseTargetConfigurationError";
  }
}

function parsePostgresUrl(name: string, value: string | undefined) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    throw new DatabaseTargetConfigurationError(`${name} is required for database operations.`);
  }

  let url: URL;
  try {
    url = new URL(trimmedValue);
  } catch {
    throw new DatabaseTargetConfigurationError(`${name} must be a valid PostgreSQL URL.`);
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new DatabaseTargetConfigurationError(
      `${name} must use the postgres or postgresql protocol.`,
    );
  }

  return { raw: trimmedValue, url };
}

function isLocalHost(hostname: string) {
  return ["127.0.0.1", "localhost", "::1"].includes(hostname.toLowerCase());
}

function databaseName(url: URL) {
  return decodeURIComponent(url.pathname.replace(/^\//, "")) || "postgres";
}

function supabaseProjectReference(url: URL) {
  const directHostMatch = /^db\.([^.]+)\.supabase\.co$/i.exec(url.hostname);
  if (directHostMatch?.[1]) return directHostMatch[1];

  const usernameMatch = /^postgres\.([^.]+)$/i.exec(decodeURIComponent(url.username));
  return usernameMatch?.[1] ?? null;
}

function resolveRequestedTarget(
  requestedTarget: string | undefined,
  location: "local" | "remote",
) {
  if (!requestedTarget?.trim()) {
    if (location === "local") return "local" satisfies DatabaseTarget;
    throw new DatabaseTargetConfigurationError(
      "DEEPREAD_DATABASE_TARGET is required for a remote database target.",
    );
  }

  if (!DATABASE_TARGETS.includes(requestedTarget as DatabaseTarget)) {
    throw new DatabaseTargetConfigurationError(
      `DEEPREAD_DATABASE_TARGET must be one of: ${DATABASE_TARGETS.join(", ")}.`,
    );
  }

  const target = requestedTarget as DatabaseTarget;
  if (target === "local" && location !== "local") {
    throw new DatabaseTargetConfigurationError(
      "A remote database cannot be classified as the local target.",
    );
  }
  if ((target === "production" || target === "preview") && location === "local") {
    throw new DatabaseTargetConfigurationError(
      `${target} database operations require an explicit remote target.`,
    );
  }

  return target;
}

function assertRuntimeAndDirectTargetsMatch(runtimeUrl: URL, directUrl: URL) {
  if (databaseName(runtimeUrl) !== databaseName(directUrl)) {
    throw new DatabaseTargetConfigurationError(
      "DATABASE_URL and DIRECT_URL must reference the same database name.",
    );
  }

  if (isLocalHost(runtimeUrl.hostname) !== isLocalHost(directUrl.hostname)) {
    throw new DatabaseTargetConfigurationError(
      "DATABASE_URL and DIRECT_URL must both be local or both be remote.",
    );
  }

  const runtimeProject = supabaseProjectReference(runtimeUrl);
  const directProject = supabaseProjectReference(directUrl);
  if (runtimeProject && directProject && runtimeProject !== directProject) {
    throw new DatabaseTargetConfigurationError(
      "DATABASE_URL and DIRECT_URL appear to reference different Supabase projects.",
    );
  }
}

export function resolveDatabaseTarget(input: {
  directUrl: string | undefined;
  runtimeUrl?: string | undefined;
  requestedTarget?: string | undefined;
  operation: DatabaseOperation;
  productionConfirmation?: string | undefined;
}): ResolvedDatabaseTarget {
  const direct = parsePostgresUrl("DIRECT_URL", input.directUrl);
  const location = isLocalHost(direct.url.hostname) ? "local" : "remote";
  const target = resolveRequestedTarget(input.requestedTarget, location);
  const runtime = input.runtimeUrl?.trim()
    ? parsePostgresUrl("DATABASE_URL", input.runtimeUrl)
    : null;

  if (runtime) {
    assertRuntimeAndDirectTargetsMatch(runtime.url, direct.url);
  }

  if (input.operation === "dev" && target !== "local" && target !== "development") {
    throw new DatabaseTargetConfigurationError(
      "prisma migrate dev is allowed only for local or development targets.",
    );
  }

  if (input.operation === "deploy") {
    if (target !== "production") {
      throw new DatabaseTargetConfigurationError(
        "Production migration deployment requires DEEPREAD_DATABASE_TARGET=production.",
      );
    }
    if (!runtime) {
      throw new DatabaseTargetConfigurationError(
        "DATABASE_URL is required to verify the production runtime target.",
      );
    }
    if (input.productionConfirmation !== PRODUCTION_MIGRATION_CONFIRMATION) {
      throw new DatabaseTargetConfigurationError(
        `DEEPREAD_PRODUCTION_MIGRATION_CONFIRMATION must equal ${PRODUCTION_MIGRATION_CONFIRMATION}.`,
      );
    }
  }

  return {
    directUrl: direct.raw,
    runtimeUrl: runtime?.raw ?? null,
    target,
    summary: {
      host: direct.url.hostname,
      database: databaseName(direct.url),
      location,
    },
  };
}

export function formatDatabaseTargetSummary(target: ResolvedDatabaseTarget) {
  return [
    `host=${target.summary.host}`,
    `database=${target.summary.database}`,
    `target=${target.target}`,
    `location=${target.summary.location}`,
  ].join(", ");
}
