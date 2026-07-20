import { Client } from "pg";

import {
  formatTestDatabaseSummary,
  loadTestDatabaseEnvironment,
  TestDatabaseConfigurationError,
} from "../test-database-environment";

const SUPABASE_ROLES = ["anon", "authenticated", "service_role"] as const;
const TESTED_ROLES = ["anon", "authenticated"] as const;
const SENSITIVE_TABLES = [
  "user",
  "account",
  "session",
  "verification",
  "bookmarks",
  "reading_notes",
  "reading_progress",
  "admin_paper_audit_logs",
  "ingestion_logs",
  "paper_sources",
  "duplicate_group_resolutions",
] as const;
const MUTATION_ACTIONS = ["INSERT", "UPDATE", "DELETE"] as const;

interface TableSecurityRow {
  schema: string;
  table: string;
  rlsEnabled: boolean;
  rlsForced: boolean;
  policyCount: number;
}

interface RoleRow {
  role: string;
  superuser: boolean;
  bypassRls: boolean;
}

interface GrantRow {
  schema: string;
  table: string;
  grantee: string;
  privileges: string;
}

interface DatabaseError {
  code?: string;
}

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function isDatabaseError(value: unknown): value is DatabaseError {
  return typeof value === "object" && value !== null && "code" in value;
}

function sanitizeDatabaseRoleName(role: string) {
  if (["postgres", "prisma", "deepread_app"].includes(role)) {
    return role;
  }

  return `sha256:${Bun.hash(role).toString(16).slice(0, 8)}`;
}

async function canSetRole(client: Client, role: (typeof TESTED_ROLES)[number]) {
  await client.query("BEGIN READ ONLY");
  try {
    await client.query(`SET LOCAL ROLE ${quoteIdentifier(role)}`);
    return true;
  } catch {
    return false;
  } finally {
    await client.query("ROLLBACK");
  }
}

async function hasTablePrivilege(client: Client, role: string, table: string, privilege: string) {
  const result = await client.query<{ allowed: boolean }>(
    "SELECT has_table_privilege($1, $2, $3) AS allowed",
    [role, `${quoteIdentifier("public")}.${quoteIdentifier(table)}`, privilege],
  );
  return result.rows[0]?.allowed ?? false;
}

async function probeSelect(
  client: Client,
  role: (typeof TESTED_ROLES)[number],
  table: string,
  hasGrant: boolean,
  rlsEnabled: boolean,
) {
  if (!hasGrant) {
    return "blocked by SQL grant";
  }

  await client.query("BEGIN READ ONLY");
  try {
    await client.query(`SET LOCAL ROLE ${quoteIdentifier(role)}`);
    const result = await client.query<{ visibleRows: string }>(
      `SELECT count(*)::text AS "visibleRows" FROM ${quoteIdentifier("public")}.${quoteIdentifier(table)}`,
    );
    const visibleRows = Number(result.rows[0]?.visibleRows ?? 0);
    return visibleRows === 0 ? (rlsEnabled ? "RLS: no rows visible" : "allowed: table empty") : `ALLOWED (${visibleRows} rows visible)`;
  } catch (error) {
    if (isDatabaseError(error) && error.code === "42501") {
      return rlsEnabled ? "blocked by RLS/policy" : "blocked by SQL grant";
    }
    return "probe failed (sanitized)";
  } finally {
    await client.query("ROLLBACK");
  }
}

async function probeMutationPlanning(
  client: Client,
  role: (typeof TESTED_ROLES)[number],
  table: string,
  action: (typeof MUTATION_ACTIONS)[number],
  hasGrant: boolean,
  rlsEnabled: boolean,
) {
  if (!hasGrant) {
    return "blocked by SQL grant";
  }

  const qualifiedTable = `${quoteIdentifier("public")}.${quoteIdentifier(table)}`;
  const statement =
    action === "INSERT"
      ? `EXPLAIN INSERT INTO ${qualifiedTable} DEFAULT VALUES`
      : action === "UPDATE"
        ? `EXPLAIN UPDATE ${qualifiedTable} SET "id" = "id" WHERE false`
        : `EXPLAIN DELETE FROM ${qualifiedTable} WHERE false`;

  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL ROLE ${quoteIdentifier(role)}`);
    await client.query(statement);
    return rlsEnabled ? "statement granted; RLS policy applies" : "ALLOWED without RLS";
  } catch (error) {
    if (isDatabaseError(error) && error.code === "42501") {
      return rlsEnabled ? "blocked by RLS/policy" : "blocked by SQL grant";
    }
    return "probe failed (sanitized)";
  } finally {
    await client.query("ROLLBACK");
  }
}

async function runRoleBehaviorAudit(
  client: Client,
  tables: TableSecurityRow[],
  existingRoles: Set<string>,
) {
  console.log("\n[Supabase Role Behavior]");
  const tableSecurity = new Map(tables.map((table) => [table.table, table]));

  for (const role of TESTED_ROLES) {
    if (!existingRoles.has(role)) {
      console.log(`${role}: skipped (role does not exist)`);
      continue;
    }

    if (!(await canSetRole(client, role))) {
      console.log(`${role}: skipped (current database user cannot SET ROLE)`);
      continue;
    }

    const rows: Array<Record<string, string>> = [];
    for (const table of SENSITIVE_TABLES) {
      const security = tableSecurity.get(table);
      if (!security) {
        continue;
      }

      const canSelect = await hasTablePrivilege(client, role, table, "SELECT");
      const mutationGrants: boolean[] = [];
      for (const action of MUTATION_ACTIONS) {
        mutationGrants.push(await hasTablePrivilege(client, role, table, action));
      }

      const select = await probeSelect(client, role, table, canSelect, security.rlsEnabled);
      const mutationResults: string[] = [];
      for (const [index, action] of MUTATION_ACTIONS.entries()) {
        mutationResults.push(
          await probeMutationPlanning(
            client,
            role,
            table,
            action,
            mutationGrants[index] ?? false,
            security.rlsEnabled,
          ),
        );
      }

      rows.push({
        table,
        select,
        insert: mutationResults[0] ?? "probe unavailable",
        update: mutationResults[1] ?? "probe unavailable",
        delete: mutationResults[2] ?? "probe unavailable",
      });
    }

    console.log(`${role}: transaction-scoped probes (all transactions rolled back)`);
    console.table(rows);
  }
}

async function main() {
  const environment = loadTestDatabaseEnvironment();
  const client = new Client({ connectionString: environment.databaseUrl });

  console.log(`[Database Security Audit] ${formatTestDatabaseSummary(environment)}`);
  console.log("Catalog inspection and role probes are read-only; no row contents are returned.");

  await client.connect();
  try {
    const tableResult = await client.query<TableSecurityRow>(`
        SELECT
          namespace.nspname AS "schema",
          class.relname AS "table",
          class.relrowsecurity AS "rlsEnabled",
          class.relforcerowsecurity AS "rlsForced",
          count(policy.polname)::int AS "policyCount"
        FROM pg_class AS class
        JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
        LEFT JOIN pg_policy AS policy ON policy.polrelid = class.oid
        WHERE namespace.nspname = 'public'
          AND class.relkind IN ('r', 'p')
        GROUP BY namespace.nspname, class.relname, class.relrowsecurity, class.relforcerowsecurity
        ORDER BY namespace.nspname, class.relname
      `);
    const grantResult = await client.query<GrantRow>(`
        SELECT
          table_schema AS "schema",
          table_name AS "table",
          grantee,
          string_agg(privilege_type, ',' ORDER BY privilege_type) AS privileges
        FROM information_schema.role_table_grants
        WHERE table_schema = 'public'
          AND grantee IN ('anon', 'authenticated')
        GROUP BY table_schema, table_name, grantee
        ORDER BY table_schema, table_name, grantee
      `);
    const roleResult = await client.query<RoleRow>(`
        SELECT rolname AS role, rolsuper AS superuser, rolbypassrls AS "bypassRls"
        FROM pg_roles
        WHERE rolname = current_user OR rolname IN ('anon', 'authenticated', 'service_role')
        ORDER BY rolname
      `);
    const currentUserResult = await client.query<{ currentUser: string }>(
      'SELECT current_user AS "currentUser"',
    );

    const grants = grantResult.rows;
    const grantsByTableAndRole = new Map(
      grants.map((grant) => [`${grant.schema}.${grant.table}:${grant.grantee}`, grant.privileges]),
    );
    const inventory = tableResult.rows.map((table) => ({
      schema: table.schema,
      table: table.table,
      "RLS enabled": table.rlsEnabled,
      "RLS forced": table.rlsForced,
      policies: table.policyCount,
      "anon grants": grantsByTableAndRole.get(`${table.schema}.${table.table}:anon`) ?? "none",
      "authenticated grants": grantsByTableAndRole.get(`${table.schema}.${table.table}:authenticated`) ?? "none",
    }));

    console.log("\n[RLS and Grant Inventory]");
    console.table(inventory);

    const currentUser = currentUserResult.rows[0]?.currentUser ?? "unknown";
    const currentRole = roleResult.rows.find((role) => role.role === currentUser);
    const existingRoles = new Set(roleResult.rows.map((role) => role.role));

    console.log("\n[Database Roles]");
    console.table([
      {
        role: "current database user",
        name: sanitizeDatabaseRoleName(currentUser),
        exists: currentUser !== "unknown",
        superuser: currentRole?.superuser ?? "unknown",
        bypassRls: currentRole?.bypassRls ?? "unknown",
      },
      ...SUPABASE_ROLES.map((role) => ({
        role,
        name: role,
        exists: existingRoles.has(role),
        superuser: roleResult.rows.find((row) => row.role === role)?.superuser ?? false,
        bypassRls: roleResult.rows.find((row) => row.role === role)?.bypassRls ?? false,
      })),
    ]);

    if (currentRole?.superuser || currentRole?.bypassRls) {
      console.log(
        "Application role finding: the configured database user can bypass RLS; tRPC ownership and admin guards remain the authoritative application-security layer.",
      );
    } else {
      console.log(
        "Application role finding: the configured database user does not bypass RLS; verify integration tests continue to pass under the current policies.",
      );
    }

    await runRoleBehaviorAudit(client, tableResult.rows, existingRoles);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof TestDatabaseConfigurationError) {
    console.error(`[Test Database Guard] ${error.message}`);
    process.exit(1);
  }

  const errorType = error instanceof Error ? error.name : typeof error;
  console.error(`Database security audit failed (${errorType}). Verify the isolated test database configuration and access.`);
  process.exit(1);
});
