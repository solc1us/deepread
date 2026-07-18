# Phase 11 Baseline Audit

Date: 2026-07-18

Scope: read-only review of testing, access control, validation, transaction safety,
performance, production configuration, deployment readiness, observability, and
project documentation. No application behavior or data was changed.

## Executive Summary

DeepRead has strong application-level foundations: public paper queries enforce
`published` status, private procedures derive ownership from the session, all admin
routers use the backend admin guard, and high-risk classification and remediation
writes generally use transactions. Bounded concurrency and batched duplicate checks
are already present.

Production readiness is limited by the absence of integration and end-to-end tests,
CI, a production migration workflow, graceful server shutdown, and a documented
deployment environment contract. No confirmed P0 data-loss or access-control flaw was
found.

| Priority | Findings |
| --- | ---: |
| P0 | 0 |
| P1 | 7 |
| P2 | 6 |
| P3 | 2 |

## Repository And Test Baseline

### Framework And Locations

- Test runner: Bun's built-in `bun:test`.
- Existing tests:
  - `packages/api/src/services/duplicate-title-groups.test.ts` (5 tests)
  - `packages/api/src/services/duplicate-paper-merge-policy.test.ts` (2 tests)
  - `apps/web/src/app/admin/_components/duplicate-resolution/duplicate-resolution-utils.test.ts` (6 tests)
- Current total: 13 tests and 25 assertions across 3 files.
- Coverage is limited to pure duplicate-title, reading-progress merge, and frontend
  duplicate-resolution helper behavior.
- No integration-test database, tRPC caller tests, HTTP tests, rendered component
  tests, browser E2E tests, or coverage configuration were found.
- No CI workflow was found.

### Runnable Commands

| Purpose | Command | Result |
| --- | --- | --- |
| Tests | `bun test` | Passed: 13, failed: 0 |
| Root typecheck | `bun run check-types` | Passed, but only `server` and `@deepread/ui` define the task |
| Web production build | `bun run --cwd apps/web build` | Passed |
| Server production build | `bun run --cwd apps/server build` | Passed with a tsdown `noExternal` deprecation warning |
| Prisma schema validation | `bunx --bun prisma validate` from `packages/db` | Passed |

The root `package.json` has no `test` or CI-oriented validation script. The root
Turbo typecheck is not a repository-wide check because `apps/web` and several
packages do not define `check-types`.

## Critical Flow Coverage

`Covered` means the complete behavior has automated verification. `Partially covered`
means only a pure helper or subset is tested.

| Area | Flow | Coverage |
| --- | --- | --- |
| Public | Browse published paper library | Not covered |
| Public | Search, category, difficulty, sort, and pagination | Not covered |
| Public | Open published paper detail | Not covered |
| Public | Block public access to unpublished papers | Not covered |
| Auth | Guest restrictions | Not covered |
| Auth | Normal-user restrictions | Not covered |
| Auth | Admin page and tRPC guard | Not covered |
| Auth | Session-derived private ownership and cross-user isolation | Not covered |
| Reading | Start, update, and complete reading progress | Not covered |
| Reading | Bookmark add/remove | Not covered |
| Reading | Note create/update/delete and grouping | Not covered |
| Reading | Statistics calculations | Not covered |
| Pipeline | OpenAlex ingestion and pagination above 100 | Not covered |
| Pipeline | Ingestion deduplication and sanitized failures | Not covered |
| Pipeline | Classification and `needs_review` routing | Not covered |
| Pipeline | Bounded ingestion/classification concurrency | Not covered |
| Remediation | Metadata update and author normalization | Not covered |
| Remediation | Rule-based and manual classification | Not covered |
| Remediation | Status transitions and missing-author workflow | Not covered |
| Remediation | Duplicate keep-both resolution | Partially covered |
| Remediation | Safe duplicate merge | Partially covered |
| Remediation | Relation preservation | Partially covered |
| Remediation | Transaction rollback | Not covered |

## Access-Control Audit

### Access Matrix

| Surface | Guest | User | Admin |
| --- | --- | --- | --- |
| Public pages and paper queries | Allowed; published papers only | Allowed; published papers only | Allowed; published papers only through public APIs |
| Authenticated pages | Redirected/denied | Allowed | Allowed |
| Admin pages | Redirected/denied | Redirected/denied | Allowed |
| Private user procedures | `UNAUTHORIZED` | Own records only | Own records only |
| Admin procedures | `UNAUTHORIZED` | `FORBIDDEN` | Allowed after database role check |

### Evidence

- `packages/api/src/index.ts` defines protected and admin middleware. The admin guard
  rechecks `ctx.session.user.id` in the database and requires role `admin`.
- Admin feature routers under `packages/api/src/routers/admin/` use `adminProcedure`.
- `packages/api/src/routers/papers.ts` and `categories.ts` constrain public paper data
  and category paper counts to `status: "published"`; public detail uses a generic
  not-found result for unpublished IDs.
- `packages/api/src/routers/shared.ts` centralizes published-paper enforcement for
  reading, note, and bookmark operations.
- `reading-progress.ts`, `bookmarks.ts`, `notes.ts`, `profile.ts`, and `statistics.ts`
  derive user identity from `ctx.session.user.id`; no client-supplied private `userId`
  input was found.
- Note update/delete operations additionally check note ownership.
- Data-quality detail responses expose aggregate relation counts, not user identities,
  note contents, or progress details.
- `apps/web/src/app/admin/layout.tsx` adds a frontend admin check, but backend guards
  remain authoritative.

No concrete unpublished-paper or cross-user data leak was found. The material risk is
that these controls currently have no automated regression coverage.

## Validation And Error Handling

- tRPC inputs use Zod throughout the inspected routers.
- OpenAlex and batch-classification limits use numeric coercion and ranges of 1-500.
- OpenAlex requests remain capped at 100 records per page.
- Metadata remediation validates authors, years, blank abstracts, and HTTP(S) URLs.
- Manual classification requires a meaningful reason and valid workflow status.
- Duplicate resolution uses a discriminated input, validates unique IDs and reason
  length, then recomputes group membership and fingerprints server-side.
- Direct publication without a complete classification is blocked.
- Router responses do not select or return `paper_sources.raw_metadata`.
- OpenAlex error examples are sanitized and capped.

One error boundary is inconsistent: `packages/api/src/services/paper-classification.ts`
uses the original `Error.message` in per-paper batch failures. A Prisma/runtime message
could therefore reach an admin mutation response and UI.

The public paper search query in `packages/api/src/routers/papers.ts` is trimmed but has
no maximum string length. Authentication and authorization are correct, but public
resource/input bounds need production hardening.

## Database And Transaction Safety

### Existing Controls

- Ingestion normalizes and deduplicates the fetched batch before writes, performs
  grouped database duplicate lookups, and writes at bounded concurrency 8.
- Each paper and source insertion is atomic through nested Prisma creation.
- Identifier-related Prisma `P2002` conflicts are treated as duplicates.
- Classification uses bounded concurrency 8 and a transaction per paper for
  classification, status, and audit updates.
- Reclassification, manual classification, metadata updates, and status changes use
  transactions where related records must remain consistent.
- Duplicate merge runs at `Serializable` isolation and atomically moves/deduplicates
  sources, bookmarks, notes, and reading progress; marks duplicate papers inactive;
  records the resolution; and writes the admin audit entry.
- Bookmark collisions preserve one canonical relation, notes retain content and
  ownership, and reading progress uses a deterministic merge policy.
- Database uniqueness and foreign keys protect DOI, provider/external ID, bookmarks,
  progress, and paper relations.

### Residual Risks

- Ingestion paper writes commit before the single ingestion-log write. A logging
  failure can leave successful inserts without a completed log or clear successful
  response; retry behavior can then be confusing even though deduplication limits
  duplicate data.
- Two classification batches can fetch the same pending papers before either updates
  them. Conditional status updates prevent silent corruption, but the losing batch
  reports avoidable failures and consumes resources.
- Transaction rollback, source collisions, bookmark collisions, note migration, and
  audit-log atomicity are not exercised against a real test database.

## Performance And Resource Safety

- OpenAlex pagination uses pages of at most 100 and an application maximum of 500.
- OpenAlex database writes use bounded concurrency 8.
- Batch classification uses bounded concurrency 8 and deduplicates selected IDs.
- The concurrency helpers do not create hundreds of simultaneous paper operations.
- Dashboard and audit aggregates use grouped/batched queries rather than category or
  paper N+1 access.
- React Query defaults use finite retries, a 30-second stale time, and no focus
  refetch. No `refetchInterval` or mutation/refetch loop was found.
- Public paper filtering keeps controls mounted and uses query-key changes with
  previous data.
- Raw provider metadata is not returned to frontend queries.

`admin.dataQuality.getOverview` necessarily reads identifier and selected metadata
sets into memory to perform normalized duplicate audits. It avoids N+1 queries, but
its cost grows linearly with the dataset and should be measured as data volume grows.

## Environment And Secret Hygiene

- No committed runtime `.env` file or obvious credential value was found.
- `.gitignore` covers environment-local files, temporary exports, and build output.
- Server validation requires `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
  and `CORS_ORIGIN`; profiling flags safely default to `false`.
- `NEXT_PUBLIC_SERVER_URL` is the only inspected public frontend environment value and
  is appropriate for browser API routing.
- OpenAlex API configuration is server-only.
- Better Auth disables role input, uses an exact trusted origin, and configures
  `HttpOnly`, `Secure`, `SameSite=None` cookies for cross-origin deployment.

Gaps:

- `packages/db/prisma.config.ts` requires `DIRECT_URL`, but
  `apps/server/.env.example` does not document it.
- There is no committed frontend environment example for `NEXT_PUBLIC_SERVER_URL`.
- The database connection/pooling strategy is not documented for production.
- Email/password registration has no documented decision or automated validation for
  email verification and account-recovery requirements.

## Deployment Readiness

### Present

- Web and server production builds complete.
- Production start commands exist for Next.js and the compiled server.
- Prisma generation and schema validation are configured.
- CORS uses one configured origin with credentials.
- A `/health` route exists.
- Admin-only database health reporting exists on the dashboard.

### Missing Or Unclear

- No CI workflow or deployment manifest exists.
- The database package exposes `prisma migrate dev`, not a production
  `prisma migrate deploy` command or release procedure.
- README setup relies on `db:push`; production migration and rollback steps are absent.
- The server binds a hardcoded port and has no `SIGINT`/`SIGTERM` shutdown handler,
  HTTP server drain, or Prisma disconnect path.
- `/health` is liveness-only and does not verify database readiness.
- Separate web/API deployment is implied by CORS and browser API URL settings, but the
  required HTTPS, trusted-origin, cookie, port, and startup contract is undocumented.
- Web and server default start commands both use port 3000 when run on one host.
- There is no documented production database pooling/connection policy.

No hosting provider is selected by the repository, so this audit does not recommend
one.

## Observability And Failure Handling

Existing visibility includes persisted ingestion logs, admin remediation audit logs,
database health on the admin dashboard, compact ingestion/classification responses,
and optional backend profilers that default to disabled.

MVP deployment still requires graceful shutdown, readiness checks, consistent
sanitized errors, and a durable or operationally searchable record of failed
classification batches. Request IDs and structured request logs would improve failure
diagnosis. Full APM, distributed tracing, and external metrics are optional after MVP.

## Documentation Audit

The README covers basic local startup, but it is stale or incomplete in these areas:

- It presents `db:push` without a production migration or rollback workflow.
- It describes typechecking as repository-wide although only two workspaces run it.
- Classifier and batch-limit descriptions do not reflect the current v2.1.4/500-record
  production behavior.
- Testing commands, test scope, and test-database setup are absent.
- `DIRECT_URL` and frontend environment setup are incomplete.
- Admin data-quality, remediation, and duplicate-resolution workflows are absent.
- Production topology, HTTPS/cookies/CORS, health checks, logging, deployment, rollback,
  and known limitations are not documented.

`DOCUMENTATION.md` was intentionally not read or modified for this audit.

## Findings

### F-01 - Critical backend flows lack integration tests

- **Priority:** P1
- **Area:** Testing / data integrity
- **Evidence:** Only three pure-helper test files exist. No Prisma test database or
  tRPC caller tests cover `paper-classification.ts`, ingestion, private ownership,
  remediation, or `admin.dataQuality.resolveDuplicateGroup`.
- **Risk:** Regressions in authorization, status routing, relation preservation, or
  rollback can reach production undetected.
- **Recommended fix:** Add an isolated test database and backend integration suite for
  public visibility, ownership, admin guards, pipeline outcomes, remediation, and
  duplicate merge transactions.
- **Suggested validation:** Run the suite from a clean database and assert rollback,
  cross-user denial, unpublished not-found behavior, and relation preservation.

### F-02 - No frontend component or browser E2E coverage

- **Priority:** P1
- **Area:** Testing / user workflows
- **Evidence:** No Playwright/Cypress configuration or rendered React tests exist;
  frontend tests cover only three pure duplicate-resolution utilities.
- **Risk:** Login shells, filtering, reading actions, admin dialogs, and cache updates
  can break despite successful builds.
- **Recommended fix:** Add focused component tests and a small E2E suite for public,
  user, and admin critical paths.
- **Suggested validation:** Run role-based E2E scenarios against an isolated seeded
  environment, including public denial of unpublished papers.

### F-03 - Validation is not automated or repository-wide

- **Priority:** P1
- **Area:** Tooling / CI
- **Evidence:** No CI workflow or root test script exists. `bun run check-types` runs
  only `server` and `@deepread/ui`; the web app is checked only as a build side effect.
- **Risk:** Pull requests can merge without tests, Prisma validation, or complete
  workspace typechecking.
- **Recommended fix:** Add explicit workspace validation scripts and CI jobs for tests,
  web/server builds, Prisma validation, formatting/linting, and diff hygiene.
- **Suggested validation:** Introduce a deliberate type/test failure in each workspace
  on a branch and verify CI rejects it.

### F-04 - No production migration and rollback workflow

- **Priority:** P1
- **Area:** Database deployment
- **Evidence:** `packages/db/package.json` exposes `prisma migrate dev`; README setup
  uses `db:push`; no `migrate deploy` release command or rollback runbook exists.
- **Risk:** Production releases may apply schema changes inconsistently or use unsafe
  development commands.
- **Recommended fix:** Add a production migration command and documented release,
  backup, failure, and forward-fix/rollback procedure. Document `DIRECT_URL`.
- **Suggested validation:** Apply all migrations to a disposable production-like
  database, start both apps, and rehearse the documented failure procedure.

### F-05 - Server lacks production lifecycle handling

- **Priority:** P1
- **Area:** Reliability / deployment
- **Evidence:** `apps/server/src/index.ts` listens on hardcoded port 3000 and registers
  no `SIGINT`/`SIGTERM`, HTTP drain, or Prisma disconnect handler.
- **Risk:** Deploy shutdowns can terminate in-flight requests and database operations;
  fixed ports reduce platform compatibility.
- **Recommended fix:** Validate a server-only `PORT`, retain the HTTP server handle,
  stop accepting requests on termination, drain with a timeout, and disconnect Prisma.
- **Suggested validation:** Start a production build, send SIGTERM during a request,
  verify clean exit, then restart immediately on the configured port.

### F-06 - Production environment contract is incomplete

- **Priority:** P1
- **Area:** Security / deployment configuration
- **Evidence:** No frontend environment example exists; `DIRECT_URL` is omitted from
  the server example; HTTPS, cookie, CORS/trusted-origin, and database pooling
  assumptions are not documented.
- **Risk:** A deployment can start with mismatched browser/API origins, unusable auth
  cookies, or unsuitable database connections.
- **Recommended fix:** Define and validate separate build/runtime variable sets and
  document exact production URL, HTTPS, CORS, cookie, and database requirements.
- **Suggested validation:** Run a production-like two-origin smoke test covering login,
  cookie persistence, tRPC calls, and database connectivity.

### F-07 - Public search lacks a bounded input and abuse plan

- **Priority:** P1
- **Area:** Input/resource security
- **Evidence:** `packages/api/src/routers/papers.ts` trims `q` but applies no maximum
  length. No public request rate/budget control is configured in the repository.
- **Risk:** Very large or repeated wildcard-style searches can consume avoidable API
  and database resources.
- **Recommended fix:** Add a conservative query-length limit and production request
  budgeting at the existing API/deployment boundary without changing search semantics.
- **Suggested validation:** Test boundary lengths, malformed input, and burst behavior;
  verify normal public browsing remains unaffected.

### F-08 - Classification batch errors can expose runtime details

- **Priority:** P2
- **Area:** Error handling
- **Evidence:** `packages/api/src/services/paper-classification.ts` returns the original
  `Error.message` in per-paper batch failure entries.
- **Risk:** An admin response may contain Prisma invocation text, local paths, or other
  implementation details.
- **Recommended fix:** Map expected errors to concise messages, log sanitized diagnostic
  context server-side, and return a generic per-paper failure otherwise.
- **Suggested validation:** Inject Prisma and classifier failures and assert API/UI
  output contains no stack, path, query, or Prisma invocation details.

### F-09 - Ingestion completion logging is outside paper-write atomicity

- **Priority:** P2
- **Area:** Reliability / auditability
- **Evidence:** `packages/api/src/routers/admin/ingestion.ts` commits per-paper writes,
  then writes the single ingestion log in the completion path.
- **Risk:** A log-write failure can produce committed papers without a completed log
  and an ambiguous client result.
- **Recommended fix:** Make log-finalization failure explicit and idempotent; preserve
  completed paper writes while returning a sanitized, accurate operation status.
- **Suggested validation:** Fault-inject ingestion-log creation after successful paper
  writes and verify deterministic counts, retry behavior, and operator visibility.

### F-10 - Concurrent classification batches can overlap

- **Priority:** P2
- **Area:** Reliability / concurrency
- **Evidence:** `runBatch` fetches pending IDs before per-paper conditional status
  updates. Two invocations can select the same IDs; one succeeds and the other reports
  failures.
- **Risk:** Resources are wasted and summaries can show misleading failures, although
  conditional updates prevent silent double publication.
- **Recommended fix:** Add an atomic claiming or equivalent database-safe selection
  strategy using existing statuses/transactions, without adding workers or queues.
- **Suggested validation:** Start two small batches concurrently and assert each paper
  is processed once with accurate aggregate results.

### F-11 - Health and production failure visibility are incomplete

- **Priority:** P2
- **Area:** Observability
- **Evidence:** `/health` is static liveness only. Classification failures are returned
  to the initiating response but have no persistent run log; general request IDs and
  structured error logs are absent.
- **Risk:** A process can appear healthy while its database is unavailable, and failed
  background-length admin operations are difficult to diagnose after the response.
- **Recommended fix:** Add a bounded database readiness check, structured sanitized
  operation/error logs, and request correlation. Keep optional profilers disabled.
- **Suggested validation:** Simulate database loss and operation failure; verify health
  state, logs, and client messages without sensitive data.

### F-12 - Email/password production policy is not established

- **Priority:** P2
- **Area:** Authentication hardening
- **Evidence:** `packages/auth/src/index.ts` enables email/password auth, but no
  documented production decision or tests cover verification and account recovery.
- **Risk:** Production may launch with accounts that cannot be safely verified or
  recovered, depending on intended registration policy.
- **Recommended fix:** Decide and document registration, verification, reset, and admin
  bootstrap policy; configure only the required Better Auth features.
- **Suggested validation:** Test registration, login, logout, session expiry, and the
  chosen verification/recovery behavior over production-like HTTPS.

### F-13 - Operational and product documentation is stale

- **Priority:** P2
- **Area:** Documentation
- **Evidence:** README classifier, batch-limit, typecheck, environment, testing,
  remediation, deployment, migration, and rollback guidance does not match the current
  repository.
- **Risk:** Developers and operators can use incorrect limits or unsafe setup/release
  procedures.
- **Recommended fix:** Reconcile setup and operations docs after Phase 11 behavior and
  deployment decisions are finalized.
- **Suggested validation:** Have a clean-machine reviewer complete setup, tests,
  migration, deployment smoke test, and rollback rehearsal using docs only.

### F-14 - Data-quality audits perform full in-memory scans

- **Priority:** P3
- **Area:** Performance
- **Evidence:** `admin.dataQuality.getOverview` loads selected published metadata and
  identifier sets to normalize missing/duplicate candidates in application memory.
- **Risk:** Refresh latency and memory use grow linearly with the dataset.
- **Recommended fix:** Establish a measured dataset threshold and optimize only when
  profiling shows a problem, preserving normalization semantics.
- **Suggested validation:** Benchmark the endpoint with representative and projected
  dataset sizes; record query count, wall time, and peak memory.

### F-15 - Server build uses a deprecated bundler option

- **Priority:** P3
- **Area:** Build maintenance
- **Evidence:** The server build passes but tsdown warns that `noExternal` is deprecated.
- **Risk:** A future toolchain upgrade may turn the warning into a build failure.
- **Recommended fix:** Migrate to the supported dependency bundling option during a
  controlled tooling update.
- **Suggested validation:** Compare server artifacts and run the production start smoke
  test after the configuration change.

## Phase 11 Implementation Backlog

### Task A - Critical Access-Control And Security Fixes

- **Scope:** Bound public search input/resource use, sanitize classification batch
  errors, and establish the production auth/origin/cookie policy.
- **Dependencies:** Deployment URL topology and registration policy decisions.
- **Expected files:** public paper input schema, classification error mapper, env/auth
  validation, focused security tests, and environment examples.
- **Acceptance criteria:** Boundary inputs are rejected predictably; no internal error
  details reach clients; guest/user/admin and cross-user access tests pass over HTTPS.
- **Split:** Backend/security prompt first; environment/auth acceptance prompt second.

### Task B - Backend Unit And Integration Tests

- **Scope:** Add an isolated database harness and tests for public visibility, private
  ownership, admin guards, ingestion, classification, remediation, and duplicate merge.
- **Dependencies:** Task A error contracts; disposable PostgreSQL database.
- **Expected files:** test helpers/fixtures, service/router integration tests, test env
  schema/example, and package/root scripts.
- **Acceptance criteria:** Critical backend flows and rollback cases pass repeatedly;
  test runs never touch development or production data.
- **Split:** Separate auth/private-data, pipeline, and remediation test prompts.

### Task C - Frontend And E2E Critical-Flow Tests

- **Scope:** Add rendered component tests and browser tests for public browsing,
  login/roles, reading actions, pipeline controls, and remediation dialogs.
- **Dependencies:** Task B fixtures and stable test accounts/data.
- **Expected files:** frontend test configuration, component tests, E2E configuration,
  fixtures, and scripts.
- **Acceptance criteria:** Public, user, and admin smoke journeys pass; unpublished and
  cross-role access remains denied; no real external ingestion runs.
- **Split:** Frontend component prompt and E2E prompt.

### Task D - Reliability And Error-Handling Hardening

- **Scope:** Prevent overlapping batch work, harden ingestion-log finalization, add
  graceful shutdown/readiness, and improve structured failure visibility.
- **Dependencies:** Task B fault-injection coverage.
- **Expected files:** classification/ingestion orchestration, server lifecycle and
  health routes, logging utilities, and integration tests.
- **Acceptance criteria:** Concurrent batches do not double-process; failures remain
  isolated and sanitized; shutdown drains safely; readiness detects database loss.
- **Split:** Pipeline reliability prompt and server lifecycle/observability prompt.

### Task E - Production Environment And Deployment Preparation

- **Scope:** Add CI, complete environment examples, production migration/start
  commands, and a provider-neutral deployment/recovery runbook.
- **Dependencies:** Tasks A-D and final deployment topology decision.
- **Expected files:** package scripts, CI workflow, environment examples, Prisma release
  scripts, and deployment docs/config selected by the project.
- **Acceptance criteria:** Clean CI passes; disposable production-like deployment can
  migrate, start, authenticate, report readiness, shut down, and recover safely.
- **Split:** CI/environment prompt and deployment/migration rehearsal prompt.

### Task F - Final Documentation And Acceptance Testing

- **Scope:** Update local setup, testing, admin workflows, operations, known limits,
  migration, deployment, rollback, and acceptance checklist.
- **Dependencies:** Tasks A-E complete and validated.
- **Expected files:** README, project documentation, runbooks, and acceptance checklist.
- **Acceptance criteria:** A clean-machine reviewer can execute the full documented
  setup and release workflow; final role-based acceptance tests pass.
- **Split:** Documentation prompt followed by final acceptance-audit prompt.

