# AGENTS.md

Be concise and implementation-focused.

Use this file for persistent guidance.
Use `CODEX_CONTEXT.md` for current phase, status, and recent decisions.
Read task-specific docs only when relevant.

## Project Purpose

DeepRead is an academic reading platform that helps students discover open-access papers, understand difficulty levels, and track reading activity.

Core product behavior:

- public paper discovery;
- Better Auth user sessions;
- reading progress, bookmarks, notes, and statistics;
- OpenAlex ingestion;
- rule-based difficulty classification;
- admin monitoring, remediation, duplicate resolution, and logs.

## Stack

- Bun
- TypeScript
- Next.js App Router
- Express
- tRPC
- Better Auth
- Prisma
- Supabase PostgreSQL
- Turborepo
- Playwright
- Vercel

Use Bun commands only:

- `bun`
- `bun run`
- `bunx --bun`

Use existing package scripts when available.

## Monorepo

- `apps/web` — Next.js frontend
- `apps/server` — Express API
- `packages/api` — tRPC routers and business logic
- `packages/auth` — Better Auth configuration
- `packages/db` — Prisma schema, migrations, and client
- `packages/env` — environment validation
- `packages/ui` — shared UI components
- `packages/config` — shared configuration

Do not move major systems across packages unless explicitly requested.

## Architecture Rules

- Keep tRPC as the application API.
- Keep Better Auth as the authentication source.
- Browser auth and tRPC requests use same-origin `/api/auth/*` and `/trpc/*`.
- Next.js proxies requests to Express through server-only `API_UPSTREAM_URL`.
- Private data ownership must come from the server session.
- Admin procedures must use the existing database-backed admin guard.
- Frontend guards are UX only; backend authorization is authoritative.
- Public paper queries must only expose `published` papers.
- Do not expose raw OpenAlex metadata, secrets, database URLs, or stack traces.

## Current Product Decisions

- OpenAlex is the active ingestion source.
- Ingestion is manually triggered by admin.
- Classification is metadata-only and rule-based.
- Current classifier: `rule-based-v2.1.4`.
- Production migrations use the guarded migration workflow.
- Never use `prisma db push` in production.
- Never run migrations during Vercel build or startup.

## Build and Verification

Local web development:

```text
next dev --webpack --port 3001
```

Use the smallest relevant verification for the change.

Documentation-only changes:

```text
git diff --check
git status --short
```

Run test, typecheck, build, E2E, Prisma, or validation suites if needed when changing:

- authentication logic;
- authorization;
- API contracts;
- database schema;
- migrations;
- environment validation;
- proxy behavior;
- protected routes;
- production runtime behavior.

## UI Changes

For frontend visual work, read `docs/ui-design.md` before editing.
Reuse existing design-system components and preserve light/dark theme support.

## Relevant Documentation

- `CODEX_CONTEXT.md` — current project status
- `DeepRead_PRD_Version_1.md` — product requirements
- `docs/environment.md` — environment contract
- `docs/operations.md` — admin and operational procedures
- `docs/production-database.md` — production database workflow
- `docs/vercel-deployment.md` — deployment setup
- `docs/release.md` — Version 1 release information
- `docs/ui-design.md` — visual direction, colors, typography, components, and interaction states
