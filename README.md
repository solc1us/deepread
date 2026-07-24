# DeepRead

DeepRead is a calm academic reading application that helps students find
beginner-friendly open-access papers, understand their estimated difficulty,
and track their reading.

Version 1 is available at
[deepread-academic.vercel.app](https://deepread-academic.vercel.app/), backed
by a separate Express API. See the [release record](docs/release.md) and
[final acceptance](docs/final-acceptance.md).

## MVP Features

Guest:

- Browse, search, filter, sort, and paginate published papers.
- View paper metadata, difficulty, beginner score, and source links.
- Register or sign in with email and password.

Authenticated reader:

- Use the focused reading view for published papers.
- Start reading, save progress, and mark papers complete.
- Add bookmarks and private notes.
- Review profile and reading statistics.

Administrator:

- Run bounded OpenAlex ingestion and classification batches.
- Monitor papers, statuses, pipeline results, and admin logs.
- Audit classification, metadata, duplicate, workflow, and integrity issues.
- Edit supported metadata and resolve `needs_review` papers.
- Record manual classifications as `manual-admin-v1`.
- Review duplicate-title candidates, keep distinct records, or safely merge
  confirmed duplicates without hard deletion.

## Technology

- Next.js 16 App Router and React 19
- Express 5 and tRPC 11
- Better Auth
- Prisma 7 and PostgreSQL/Supabase
- Bun 1.3.13 and TypeScript
- Tailwind CSS and shared shadcn-style UI primitives
- Turborepo
- Bun test, Testing Library, and Playwright Chromium

## Architecture

```text
Browser
  -> Next.js web
  -> same-origin /api/auth/* and /trpc/*
  -> Next.js external rewrites
  -> Express API
  -> Prisma
  -> Supabase PostgreSQL
```

The browser does not connect to PostgreSQL or Supabase directly. Better Auth
and tRPC use same-origin browser paths; the web server forwards those requests
to the separate API through the server-only `API_UPSTREAM_URL`.

Client route guards provide loading, redirect, and navigation behavior only.
Express/tRPC session checks, database-scoped ownership checks, and the
database-backed admin guard are the security boundaries.

OpenAlex ingestion is admin-triggered. Imported metadata is normalized and
deduplicated before database writes. The production difficulty classifier is
the deterministic metadata-only `rule-based-v2.1.4`; quality-gate failures are
routed to `needs_review`.

See [Environment Contract](docs/environment.md),
[Vercel Deployment](docs/vercel-deployment.md), [Production Database](docs/production-database.md),
and [MVP Operations](docs/operations.md).

## Repository

```text
apps/
  web/       Next.js application
  server/    Express standalone and Vercel Function entrypoints
packages/
  api/       tRPC routers and application services
  auth/      Better Auth configuration
  config/    Shared TypeScript configuration
  db/        Prisma schema, migrations, generated client, and database scripts
  env/       Environment schemas and production validation
  ui/        Shared UI components and styles
tests/
  e2e/       Guarded local Playwright journeys
docs/        Environment, database, deployment, security, and operations guides
```

## Prerequisites

- Bun `1.3.13`
- Node.js `22.x` for Node-targeted runtime checks
- PostgreSQL or Supabase PostgreSQL for local application data
- Chromium installed by Playwright only when E2E tests are needed

The database-free unit, component, build, typecheck, and Prisma schema
validation commands do not require a reachable database.

## Local Setup

1. Install dependencies:

   ```bash
   bun install --frozen-lockfile
   ```

2. Create ignored local environment files:

   ```text
   apps/server/.env.example -> apps/server/.env
   apps/web/.env.example    -> apps/web/.env
   ```

3. Configure a local/development PostgreSQL target. Use a pooled/runtime URL as
   `DATABASE_URL` and a direct URL for the same database as `DIRECT_URL`.

4. Generate Prisma Client and apply checked-in migrations:

   ```bash
   bun run db:generate
   bun run db:migrate:dev
   ```

   `db:migrate:dev` is only for local or explicitly classified development
   targets. Do not use `db:push` or `migrate reset` for production.

5. Start both applications:

   ```bash
   bun run dev
   ```

   Web: `http://localhost:3001`

   API: `http://localhost:3000`

Use `bun run dev:web` or `bun run dev:server` to run one application.

The optional development seed requires `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and
`ADMIN_NAME`, then runs with:

```bash
bun run db:seed
```

It is not a production administrator bootstrap.

## Environment

Server-only application values:

```text
DATABASE_URL
DIRECT_URL
BETTER_AUTH_SECRET
BETTER_AUTH_URL
CORS_ORIGIN
PORT
NODE_ENV
```

Web values:

```text
API_UPSTREAM_URL          # server-only Next.js rewrite destination
NEXT_PUBLIC_SERVER_URL    # public web origin validation
```

Optional API values include `OPENALEX_API_KEY`, `OPENALEX_BASE_URL`,
`CLASSIFICATION_PROFILING`, and `OPENALEX_INGESTION_PROFILING`.

Never expose database URLs, `BETTER_AUTH_SECRET`, or `API_UPSTREAM_URL` through
`NEXT_PUBLIC_*`. Preview and production use exact HTTPS origins with no
wildcard CORS.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start web and API development processes. |
| `bun run dev:web` | Start Next.js on port 3001. |
| `bun run dev:server` | Start Express on port 3000. |
| `bun run check-types` | Typecheck first-party TypeScript workspaces. |
| `bun run build` | Build the web and bundled server runtime. |
| `bun run test` | Run database-free unit and component tests once. |
| `bun run test:web` | Run focused web component tests. |
| `bun run validate:prisma` | Generate Prisma Client and validate the schema. |
| `bun run validate` | Generate, test, typecheck, build, and validate Prisma. |
| `bun run db:migrate:status` | Inspect a guarded migration target. |
| `bun run db:migrate:dev` | Run development migrations on local/development. |
| `bun run db:migrate:deploy` | Deploy checked-in migrations to confirmed production. |
| `bun run db:smoke` | Run a guarded lightweight database check. |

## Testing

| Command | Coverage | Database |
| --- | --- | --- |
| `bun run test` | Unit tests and rendered component behavior | None |
| `bun run test:web` | Paper filters and admin remediation components | None |
| `bun run test:integration:access` | Public visibility, ownership, and admin guard | Isolated test DB |
| `bun run test:integration:reading` | Progress, bookmarks, notes, and statistics | Isolated test DB |
| `bun run test:integration:pipeline` | Ingestion, classification, remediation, and rollback | Isolated test DB |
| `bun run test:integration` | All three integration suites | Isolated test DB |
| `bun run test:e2e` | Guest, reader, and admin Chromium journeys | Isolated test DB |
| `bun run test:e2e:headed` | Same E2E suite with visible Chromium | Isolated test DB |
| `bun run audit:database-security` | Read-only RLS, role, policy, and grant inventory | Isolated test DB |

Database-backed tests require an ignored `.env.test.local` created from
`.env.test.example`:

```text
TEST_DATABASE_URL=
TEST_DIRECT_URL=
DEEPREAD_TEST_DATABASE_CONFIRMATION=deepread-test-only
```

Apply checked-in migrations with `bun run test:integration:migrate`. The guard
refuses missing confirmation and URLs matching development connections.
Fixtures use unique run identifiers and cleanup only test-owned data.

E2E runs locally with one Chromium worker, starts the web/API on ports 3001 and
3002, and blocks unexpected browser network origins. E2E and database-backed
integration tests do not run in the current GitHub Actions workflow.

## Production

DeepRead uses two Vercel projects from the same repository:

```text
https://<web-domain>  -> deepread-web -> apps/web
https://<api-domain>  -> deepread-api -> apps/server
```

The web project proxies browser auth and tRPC traffic to the API. Prisma
migrations are a separate guarded owner operation and never run during Vercel
install, build, startup, or deployment.

Start production admin ingestion and classification with limits of `5-25`.
Increase only after reviewing Vercel duration and persisted pipeline results.

## MVP Limitations

- Public email/password registration is enabled.
- Email ownership is not verified.
- Forgot-password and reset-password flows are unavailable.
- Administrator promotion is manual; role changes may require session refresh
  or logout/login.
- Papers are read from external source/PDF links; DeepRead does not parse or
  store PDFs.
- Reading progress is manual and reading-time statistics are estimates.
- Classification is metadata-only and does not use an external AI/LLM.
- Admin ingestion and classification run synchronously; no queue, worker,
  scheduler, or cron is deployed.
- Duplicate-title matches are review candidates, not automatic duplicates.
