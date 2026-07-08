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
- admin monitoring later

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
- Phase 5: reading mode, progress, bookmarks, notes, grouped notes, profile, role-aware navbar, UI polish
- Phase 6: application-layer access control audit
- Phase 6.5: tRPC routers split by feature
- Phase 7: user reading statistics dashboard

Planned:

- Phase 8: admin monitoring dashboard and pipeline controls
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

- only show/use admin links if actual route exists and works
- Phase 8 will add/admin-polish admin monitoring dashboard

---

## Important tRPC Paths

Admin:

- `admin.ingestion.runOpenAlex`
- `admin.ingestion.logs`
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
- Private user data must use `ctx.session.user.id` or project equivalent.
- Never trust `userId` from client input.
- Users can access only their own reading progress, bookmarks, notes, profile, and statistics.
- Admin procedures must use existing admin guard.
- Do not use `x-admin-secret`.
- Do not create a new auth system.

---

## MVP Technical Decisions

- Ingestion is manually admin-triggered for now.
- OpenAlex is the only active ingestion source for now.
- Difficulty classification is metadata-only.
- Do not parse/store PDFs.
- Users read through external source/PDF links.
- Reading progress is manual.
- Pause/save keeps status `reading`, saves progress, updates `last_read_at`.
- Completed means status `completed`, progress `100`, set `completed_at`.
- Statistics reading time is estimated, not real tracked duration.
- No external AI/LLM APIs for classifier.
- No new infrastructure unless requested.
- Do not enable RLS yet.

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

Navbar:

- Guest: Home, Papers, Login/Register if route exists
- User: Papers, Profile, Notes, Statistics, Logout
- Admin: Papers, working admin links, optional user links, Logout
- Never show broken/no-access links.

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
