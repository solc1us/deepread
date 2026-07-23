# Database Security Checklist

Use only an isolated local PostgreSQL/Supabase database or a separate remote Supabase test project. Never use development or production connection URLs.

Local Supabase/PostgreSQL is the preferred repeatable option. A separate remote Supabase test project is also supported because the harness consumes standard PostgreSQL URLs and does not depend on Docker or Supabase CLI commands.

## Test Database Setup

1. Copy `.env.test.example` to `.env.test.local`.
2. Set `TEST_DATABASE_URL` and `TEST_DIRECT_URL` to the isolated test database.
3. Keep `DEEPREAD_TEST_DATABASE_CONFIRMATION=deepread-test-only` unchanged.
4. Apply existing migrations with `bun run test:integration:migrate`.
5. Run access tests with `bun run test:integration:access`.
6. Run the read-only security inventory with `bun run audit:database-security`.

The guarded commands refuse URLs equal to `DATABASE_URL` or `DIRECT_URL`. They print only a sanitized local host/database name or a fingerprinted remote database summary.

The integration commands are intentionally excluded from ordinary `bun test`, `bun run validate`, and the current GitHub Actions workflow. They run only through the explicit commands above.

## Supabase Data API Manual Check

- Open **Supabase Dashboard → Data API integration**.
- Verify whether the Data API is enabled.
- Verify which schemas are exposed.
- Verify a publishable/anon key cannot query application tables.
- Verify private tables, audit logs, ingestion logs, and `paper_sources.raw_metadata` are not exposed.

Data API enablement cannot be inferred reliably from a Prisma database connection. DeepRead currently uses Prisma on the backend and has no established client-side Supabase Data API requirement, so disable the Data API unless a concrete client-side use case is approved.

The audit command does not change roles, grants, RLS settings, policies, or Supabase dashboard configuration.

## Production Supabase Preparation

Complete these checks manually on the separate production project before deployment:

- Confirm whether the Data API is enabled and which schemas it exposes.
- Confirm the browser uses only the Express/tRPC API and has no Supabase URL or key.
- Review `anon` and `authenticated` SQL grants on application tables.
- Inventory RLS enablement, forced status, and policies; do not assume RLS replaces tRPC ownership checks.
- Verify the Prisma application role and service role have only the privileges they require.
- Confirm backup/recovery availability before applying migrations.
- Use pooled connectivity for application traffic and a direct connection for migrations.
- Rotate database credentials and application secrets before production launch.

DeepRead is backend-only for database access. Its primary authorization layer remains the tRPC admin guard and database-backed session ownership checks. Use the existing guarded `audit:database-security` command only with an isolated test database; production review remains a manual Supabase dashboard and SQL-catalog exercise.
