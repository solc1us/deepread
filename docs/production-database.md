# Production Database Workflow

DeepRead uses separate database targets:

| Environment | Database |
| --- | --- |
| Local integration/E2E | Local isolated PostgreSQL/Supabase via `.env.test.local` |
| Development | Existing cloud Supabase development project |
| Preview | Explicit non-production target selected by the owner |
| Production | Separate empty Supabase project created manually by the owner |

`DATABASE_URL` is the pooled application runtime connection. `DIRECT_URL` is the direct connection used by Prisma migrations and administrative checks. Neither value belongs in browser environment variables.

## Commands

```text
bun run db:generate
bun run db:validate
bun run db:migrate:status
bun run db:migrate:dev
bun run db:migrate:deploy
bun run db:smoke
```

`db:migrate:dev` runs `prisma migrate dev` and is limited to local/development targets. `db:migrate:deploy` runs `prisma migrate deploy`, never seeds data, and requires an explicit remote production target plus confirmation. Production must never use `prisma db push` or `prisma migrate reset`. Run `bun run db:seed` only as a separate, deliberate local-development action.

Vercel install, build, function startup, and deployment do not run migrations
or seeds. Keep `DIRECT_URL` in the owner's migration environment rather than
the Vercel runtime.

Remote commands require `DEEPREAD_DATABASE_TARGET` so an unclassified URL is rejected. Commands print only the database host, database name, target classification, and local/remote status; credentials and complete URLs are never printed.

## Production Rehearsal

1. Create a separate empty Supabase production project manually.
2. Obtain its pooled runtime URL and direct migration URL.
3. Configure `DATABASE_URL` and `DIRECT_URL` locally without committing them.
4. Create a backup or recovery point where the Supabase plan supports it.
5. Set and inspect the target:

   ```powershell
   $env:DEEPREAD_DATABASE_TARGET="production"
   bun run db:migrate:status
   ```

6. Confirm the printed host/database is the new production project, then apply checked-in migrations:

   ```powershell
   $env:DEEPREAD_PRODUCTION_MIGRATION_CONFIRMATION="deploy-deepread-production"
   bun run db:migrate:deploy
   ```

7. Run `bun run db:validate`.
8. Run `bun run db:smoke` with the same explicit target.
9. Create the first production account later through the deployed application.
10. Assign that account the admin role manually only after the production application is available.

Do not copy development data or run the development seed. If migration
deployment fails, stop, retain the sanitized Prisma output, and use the
Supabase recovery point or a reviewed forward migration. Do not reset the
production database. After a successful migration, verify API `/ready`, then
complete the application smoke checklist in [`operations.md`](operations.md).

Application rollback and database recovery are separate. Promoting a previous
Vercel deployment does not undo a migration. Confirm schema compatibility
before rolling application code backward.

## Isolated Test Migration

The existing test workflow remains separate:

```text
bun run test:integration:migrate
```

It requires `TEST_DATABASE_URL`, `TEST_DIRECT_URL`, and `DEEPREAD_TEST_DATABASE_CONFIRMATION=deepread-test-only`, rejects application database URLs, and applies only checked-in migrations. It does not use the production confirmation variables.
