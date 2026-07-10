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
- admin monitoring dashboard

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

Completed:

- Phase 1: setup, DB, auth, user/admin role
- Phase 2: paper schema, library, search/filter/sort, detail
- Phase 3: OpenAlex ingestion, normalization, dedupe, logs
- Phase 3.5: admin auth, admin guard, removed `x-admin-secret`
- Phase 4: rule-based classifier, classification service, admin classification tools
- Phase 5: reading mode, progress, bookmarks, notes, grouped notes, profile, role-aware sidebar/navbar, UI polish
- Phase 6: application-layer access control audit
- Phase 6.5: tRPC routers split by feature
- Phase 7: user reading statistics dashboard
- Phase 8: admin monitoring dashboard, admin sidebar, pipeline controls, logs table, papers monitor, DB health status

Planned:

- Phase 8.5: classifier evaluation/calibration
- Phase 9: data expansion and cleanup
- Phase 10: final testing, hardening, deployment, docs update

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
- `admin.ingestion.getQueryPresets`
- `admin.logs.list`
- `admin.papers.list`
- `admin.classification.runForPaper`
- `admin.classification.runBatch`
- `admin.classification.preview` if implemented

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

- Ingestion is manually admin-triggered for now.
- OpenAlex is the only active ingestion source for now.
- Admin ingestion query input uses curated presets.
- Difficulty classification is metadata-only.
- Do not parse/store PDFs.
- Users read through external source/PDF links.
- Reading progress is manual.
- Pause/save keeps status `reading`, saves progress, updates `last_read_at`.
- Completed means status `completed`, progress `100`, set `completed_at`.
- Statistics reading time is estimated, not real tracked duration.
- Admin dashboard is monitoring/control UI only, not a worker/scheduler system.
- No external AI/LLM APIs for classifier.
- No new infrastructure unless requested.

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
- Admin: sidebar with Overview, Pipeline, Logs, Classification, Papers Monitor, optional User App group, Logout
- Never show broken/no-access links.
- Never show admin links to normal users.
- Authenticated users should not lose sidebar when navigating to public-capable pages.

---

## Performance Rules

Recent mitigation:

- use `next dev --webpack --port 3001`
- bounded React Query cache
- disabled focus refetch
- reduced retries
- removed always-mounted React Query Devtools

Avoid:

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
