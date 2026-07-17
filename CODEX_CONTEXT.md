# CODEX_CONTEXT.md

# DeepRead - Compact Codex Context

Use this file with `AGENTS.md`.
Do not read the full `DOCUMENTATION.md` unless a missing product decision blocks the task.

---

## Product

DeepRead helps students discover and read beginner-friendly open-access academic papers.

Core MVP:

- OpenAlex paper ingestion
- rule-based difficulty classification
- paper library/detail
- reading mode
- reading progress
- bookmarks
- notes
- profile
- reading statistics
- admin monitoring and pipeline controls
- admin data-quality audit and remediation

---

## Stack

- Monorepo: Better-T-Stack
- Frontend: Next.js App Router
- Backend: Express
- API: tRPC
- Auth: Better Auth
- DB: Supabase PostgreSQL
- ORM: Prisma
- Runtime/package manager: Bun
- Language: TypeScript

Important:

- Current API style is tRPC, not REST.
- Keep Better Auth as the auth/session source.
- Do not replace Better Auth.
- Do not assume Bearer auth unless the existing code explicitly uses it.
- Use server-side session user id for private data.

---

## Completed Phases

## Completed Phases

Completed:

- Phase 1: project setup, database, Better Auth, user/admin roles
- Phase 2: paper schema, public library, search/filter/sort, paper detail
- Phase 3: OpenAlex ingestion, normalization, deduplication, ingestion logs, admin authorization guard, removal of `x-admin-secret`
- Phase 4: metadata-only rule-based classifier, classification service, admin classification tools
- Phase 5: reading mode, progress, bookmarks, notes, profile, role-aware navigation, UI polish
- Phase 6: application-layer access-control audit and tRPC router split by feature
- Phase 7: user reading-statistics dashboard
- Phase 8: admin monitoring dashboard, pipeline controls, logs, paper monitor, and database-health status
- Phase 9: classifier evaluation and calibration, production classifier v2.1.4, paper-status workflow, legacy reclassification, backend profiling, and bounded-concurrency optimization

In progress:

- Phase 10: data-quality audit, issue drill-down, admin remediation, metadata cleanup, duplicate review, manual relevance spot-check, and dataset freeze

Planned:

- Phase 11: final testing, hardening, deployment, and documentation update

Deferred:

- Redis/BullMQ/workers
- scheduler/cron
- PDF parsing/local PDF storage
- Unpaywall/Crossref integration
- Supabase RLS strategy
- advanced recommendations

---

## Current Routes

Public:

- `/`
- `/papers`
- `/papers/[id]`

Authenticated user:

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

Navigation behavior:

- Guest users use public navbar.
- Logged-in normal users use user sidebar.
- Logged-in admin users use admin sidebar.
- Authenticated users should keep their sidebar even when visiting public-capable routes like `/papers`.

---

## Important tRPC Paths

Admin:

- `admin.dashboard.getOverview`
- `admin.ingestion.runOpenAlex`
- `admin.ingestion.logs`
- `admin.logs.list`
- `admin.papers.list`
- `admin.classification.runForPaper`
- `admin.classification.runBatch`
- `admin.dataQuality.getOverview`
- `admin.dataQuality.getDetails`

User:

- `reading.start`
- `reading.updateProgress`
- `reading.complete`
- `reading.getForPaper`
- `bookmark.list`
- `bookmark.add`
- `bookmark.remove`
- `bookmark.getForPaper`
- `notes.listForPaper`
- `notes.listMineGroupedByPaper`
- `notes.create`
- `notes.update`
- `notes.delete`
- `profile.getOverview`
- `statistics.getMine`

Preserve existing procedure paths unless explicitly asked.

---

## Auth Rules

Roles:

- `user`
- `admin`

Rules:

- Guest can browse public paper pages only.
- Guest cannot access reading mode, profile, notes, statistics, or admin pages.
- Private user data must use `ctx.session.user.id` or project equivalent.
- Never trust `userId` from client input.
- Users can access only their own reading progress, bookmarks, notes, profile, and statistics.
- Admin procedures must use existing admin guard.
- Normal users cannot access `/admin/*`.
- Do not use `x-admin-secret`.
- Do not create a new auth system.
- Do not enable RLS yet.

---

## MVP Technical Decisions

- Ingestion is manually triggered by admins.
- OpenAlex is the only active ingestion source.
- Admin ingestion accepts a free-text OpenAlex search query and category selection.
- Application ingestion limit is 1–500 papers.
- OpenAlex requests fetch at most 100 works per request and paginate internally.
- OpenAlex database writes use bounded concurrency of 8.
- Batch classification uses bounded concurrency of 8.
- Production classifier version is `rule-based-v2.1.4`.
- Difficulty classification is metadata-only.
- Papers failing the classifier quality gate use `needs_review`.
- Public paper queries expose only `published` papers.
- Paper statuses are:
  - `pending`
  - `needs_review`
  - `published`
  - `rejected`
  - `inactive`
- Existing published paper IDs and user relations must be preserved during cleanup.
- Do not delete and re-ingest papers to reclassify them.
- Do not parse or store PDFs.
- Users read through external source/PDF links.
- Reading progress is manual.
- Pause/save keeps status `reading`, saves progress, and updates `last_read_at`.
- Completed means status `completed`, progress `100`, and sets `completed_at`.
- Statistics reading time is estimated, not real tracked duration.
- Admin tools include monitoring, pipeline control, data-quality auditing, and controlled remediation.
- No external AI/LLM APIs are used by the classifier.
- No workers, scheduler, or additional infrastructure unless explicitly requested.

---

## UI Rules

Use calm academic reading interface:

- academic blue
- warm neutral background
- white cards
- subtle borders
- readable typography
- clean spacing
- consistent border radius
- no heavy glassmorphism
- no flashy AI startup style

Navigation:

- Guest: public navbar with Home, Papers, Login/Register if route exists
- User: sidebar with Papers, Profile, Notes, Statistics, Logout
- Admin: sidebar with Overview, Pipeline, Logs, Classification, Papers Monitor, Data Quality, optional User App group, and Logout
- Never show broken/no-access links.
- Never show admin links to normal users.
- Authenticated users should not lose sidebar when navigating to public-capable pages.

---

## Performance Rules

Current mitigations:

- use `next dev --webpack --port 3001`
- root development uses streamed Turbo output
- bounded React Query cache
- disabled focus refetch
- reduced retries
- removed always-mounted React Query Devtools
- OpenAlex ingestion database writes use bounded concurrency of 8
- batch classification uses bounded concurrency of 8
- optional backend profiling is disabled by default:
  - `CLASSIFICATION_PROFILING=false`
  - `OPENALEX_INGESTION_PROFILING=false`

Avoid:

- worker threads for the current metadata-only classifier
- unbounded `Promise.all` over large paper batches
- `refetchInterval`
- mutation/refetch loops
- repeated session subscriptions
- copying query data into state without need
- returning raw OpenAlex metadata
- returning `paper_sources.raw_metadata`

Keep frontend payloads compact.

---

## Router Structure

Routers are split by feature.

Rule:

- `routers/index.ts` should only compose routers.
- Do not add large feature blocks back into `routers/index.ts`.
- Preserve existing tRPC paths.
- Avoid circular imports.

## Current Phase 10 Rules

- Dataset currently contains approximately 1,500 published papers.
- Every published paper should have a complete classification.
- Current production classification version is `rule-based-v2.1.4`.
- Data Quality overview and drill-down pages are permanent admin features.
- Data-quality remediation must preserve paper IDs and user relations.
- Missing metadata may be edited by admins with field-specific validation.
- `needs_review` papers may only become published after:
  - successful rule-based reclassification; or
  - explicit manual admin classification.
- Probable duplicate-title matches are review candidates, not automatically confirmed duplicates.
- Do not hard-delete duplicate papers before relations and sources are handled safely.
- Targeted ingestion should only be performed when the audit identifies a real dataset gap.
