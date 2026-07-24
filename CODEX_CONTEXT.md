# DeepRead - Compact Codex Context

Use this file with `AGENTS.md`. Do not read the full `DOCUMENTATION.md` unless
a missing product decision blocks the task.

## Product

DeepRead helps students discover and read beginner-friendly open-access
academic papers.

Core MVP:

- public paper library, search, filters, sorting, pagination, and detail;
- Better Auth registration/session handling;
- reading mode, progress, bookmarks, notes, profile, and statistics;
- manual OpenAlex ingestion and rule-based difficulty classification;
- admin monitoring, pipeline controls, logs, and paper status workflow;
- permanent data-quality audit, issue drill-downs, metadata remediation,
  needs-review handling, and safe duplicate resolution.

## Stack

- Monorepo: Bun workspaces and Turborepo
- Web: Next.js App Router, React, Tailwind CSS
- API: Express and tRPC
- Auth: Better Auth
- Database: Supabase PostgreSQL through Prisma
- Deployment target: two Vercel Hobby projects
- Language/runtime: TypeScript, Bun locally, Node.js 22 Vercel runtime

## Release Status

- Phases 1-10 are complete.
- Phase 11 testing, security, reliability, environment, database, and Vercel
  preparation are implemented.
- The paired Vercel Preview web/API architecture has been tested.
- Production is not launched.
- Remaining owner work: create/configure the separate production Supabase
  project, run guarded migrations, configure production Vercel values, deploy,
  and complete acceptance/smoke testing.

## Architecture

```text
Browser
  -> Next.js web
  -> relative /api/auth/* and /trpc/*
  -> Next.js external rewrites
  -> Express API
  -> Prisma
  -> Supabase PostgreSQL
```

- `deepread-web` uses `apps/web`.
- `deepread-api` uses `apps/server`.
- `API_UPSTREAM_URL` is server-only in the web project.
- `NEXT_PUBLIC_SERVER_URL`, `BETTER_AUTH_URL`, and `CORS_ORIGIN` use the exact
  public web origin.
- Browser auth/tRPC requests remain same-origin; no wildcard CORS is allowed.
- The browser never receives database URLs, auth secrets, or the API upstream.
- Client guards provide UX only. tRPC session ownership and the database-backed
  admin guard are authoritative.
- Express exposes `/health` without a database query and `/ready` with a
  two-second bounded database check.
- Responses include `x-request-id`; unexpected failures are sanitized.

## Completed Phases

- Phase 1: project setup, database, Better Auth, and roles
- Phase 2: public paper library, search/filter/sort, and detail
- Phase 3: OpenAlex ingestion, normalization, deduplication, and admin guard
- Phase 4: metadata-only rule-based classification and admin tools
- Phase 5: reading, progress, bookmarks, notes, profile, and navigation
- Phase 6: application access-control audit and feature router split
- Phase 7: reading statistics
- Phase 8: admin dashboard, pipeline, logs, and paper monitoring
- Phase 9: classifier calibration, v2.1.4 production activation, status
  workflow, profiling, and bounded concurrency
- Phase 10: dataset audit, remediation, needs-review workflow, and safe
  duplicate resolution

In progress:

- Phase 11: final owner deployment, production validation, acceptance testing,
  and release documentation

Deferred:

- Redis, queues, workers, scheduler, and cron
- PDF parsing or local PDF storage
- Unpaywall/Crossref ingestion
- production RLS strategy
- advanced recommendations

## Routes

Public:

- `/`
- `/papers`
- `/papers/[id]`
- `/login`

Authenticated:

- `/papers/[id]/read`
- `/profile`
- `/notes`
- `/statistics`

Admin:

- `/admin`
- `/admin/pipeline`
- `/admin/logs`
- `/admin/classification`
- `/admin/papers`
- `/admin/papers/[id]`
- `/admin/data-quality`
- `/admin/data-quality/details`

`/dashboard` is a compatibility redirect to `/admin`.

## Important tRPC Paths

Admin:

- `admin.dashboard.getOverview`
- `admin.ingestion.runOpenAlex`
- `admin.ingestion.logs`
- `admin.logs.list`
- `admin.papers.list`
- `admin.papers.detail`
- `admin.papers.updateMetadata`
- `admin.papers.reclassify`
- `admin.papers.manualClassifyAndPublish`
- `admin.papers.deactivate`
- `admin.papers.reactivate`
- `admin.papers.reject`
- `admin.papers.publish` (complete-classification guard)
- `admin.classification.runForPaper`
- `admin.classification.runBatch`
- `admin.classification.preview`
- `admin.dataQuality.getOverview`
- `admin.dataQuality.getDetails`
- `admin.dataQuality.resolveDuplicateGroup`

User:

- `papers.list`, `papers.detail`, `categories.list`
- `reading.start`, `reading.updateProgress`, `reading.complete`,
  `reading.getForPaper`
- `bookmark.list`, `bookmark.add`, `bookmark.remove`,
  `bookmark.getForPaper`
- `notes.listForPaper`, `notes.listMineGroupedByPaper`, `notes.create`,
  `notes.update`, `notes.delete`
- `profile.getOverview`
- `statistics.getMine`

Preserve procedure paths unless explicitly requested.

## Auth And Visibility

- Public registration is enabled.
- Email verification and forgot/reset-password are unavailable.
- Private ownership always derives from the server session user ID.
- Public paper procedures expose only `published` papers.
- Unpublished and nonexistent public detail requests use the same not-found
  behavior.
- Normal users cannot call admin procedures.
- Admin middleware rechecks the current database role.
- Administrator promotion is manual.
- Role changes may require session refresh or logout/login.
- Do not add `x-admin-secret`, public role updates, or a second auth system.
- Supabase Data API and RLS settings are owner-reviewed separately; current
  application authorization remains authoritative.

## Pipeline And Classification

- OpenAlex is the only active source and ingestion is admin-triggered.
- Ingestion accepts free-text queries and a DeepRead category.
- Application ingestion limit: 1-500.
- OpenAlex page size: at most 100.
- Ingestion database write concurrency: 8.
- Classification batch limit: 1-500.
- Classification concurrency: 8.
- Overlapping batches atomically claim pending papers.
- Production classifier: `rule-based-v2.1.4`.
- Manual admin classification: `manual-admin-v1`.
- Classification is metadata-only; no external AI/LLM or PDF parsing.
- Quality-gate failures become `needs_review`, not rejected.
- Public papers require a complete classification.
- Initial Vercel Hobby ingestion/classification limit: 5-25; increase only
  after reviewing duration and logs.
- Optional ingestion/classification profiling defaults to disabled.

Paper statuses:

- `pending`
- `needs_review`
- `published`
- `rejected`
- `inactive`

## Remediation Rules

- `needs_review` publication requires successful reclassification or explicit
  manual classification.
- Metadata edits do not automatically classify or change status.
- Preserve paper IDs, sources, bookmarks, notes, and reading progress.
- Duplicate-title matches are candidates, not confirmed duplicates.
- Keep-both records an exact reviewed fingerprint without changing papers.
- Merge preserves the selected paper, moves/deduplicates sources and user
  relations transactionally, and marks duplicate papers inactive.
- Hard deletion is not part of remediation.

## Testing

Database-free:

```text
bun run test
bun run test:web
bun run check-types
bun run build
bun run validate:prisma
bun run validate
```

Isolated PostgreSQL/Supabase:

```text
bun run test:integration:migrate
bun run test:integration:access
bun run test:integration:reading
bun run test:integration:pipeline
bun run test:integration
bun run audit:database-security
bun run test:e2e
bun run test:e2e:headed
```

Database-backed commands require `.env.test.local`,
`TEST_DATABASE_URL`, the appropriate `TEST_DIRECT_URL`, and
`DEEPREAD_TEST_DATABASE_CONFIRMATION=deepread-test-only`. They reject
development URLs and clean only test-owned fixtures. E2E uses local web/API
ports, one Chromium worker, and blocks unexpected browser origins.

GitHub Actions runs one database-free `bun run validate` job plus
`git diff --check`. Integration and E2E suites are local-only.

## Database And Deployment

- `DATABASE_URL` is the pooled application runtime connection.
- `DIRECT_URL` is the matching direct migration/admin connection.
- Local test, development, Preview, and production targets must be explicit.
- Production uses a separate empty Supabase project; do not copy development
  data automatically.
- Production migration uses guarded `prisma migrate deploy`.
- Never run `db push`, `migrate reset`, seeds, or migrations from Vercel build
  or function startup.
- Application rollback uses a prior Vercel deployment; database recovery uses
  a backup/recovery point or reviewed forward migration.

See:

- `README.md`
- `docs/environment.md`
- `docs/operations.md`
- `docs/production-database.md`
- `docs/vercel-deployment.md`
- `docs/database-security-checklist.md`

## Current Phase 11 Focus

- owner production Supabase setup and security checklist;
- guarded production migration rehearsal;
- production Vercel environment configuration;
- production deployment and smoke tests;
- final acceptance testing and release decision.
