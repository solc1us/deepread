# CODEX_CONTEXT.md

# DeepRead - Codex Working Context

This file is the compact implementation context for Codex.
Use this file together with `AGENTS.md` for development tasks.

Do not scan the full `DOCUMENTATION.md` unless a product decision is missing or the task explicitly requires PRD-level context.

---

## 1. Product Summary

DeepRead is a web application that helps students discover and read beginner-friendly open-access academic papers.

Core value:

- help students find suitable papers
- classify paper difficulty automatically
- support reading progress, bookmarks, notes, and reading habit formation

MVP focus:

- paper discovery
- OpenAlex ingestion
- rule-based difficulty classification
- paper library and paper detail
- reading mode
- reading progress
- bookmarks
- notes
- user profile summary
- later: reading statistics and admin monitoring dashboard

---

## 2. Tech Stack

Current implementation uses Better-T-Stack monorepo.

Stack:

- Frontend: Next.js App Router
- Backend: Express
- API: tRPC
- Auth: Better Auth
- Database: Supabase PostgreSQL
- ORM: Prisma
- Runtime/package manager: Bun
- Language: TypeScript

Important:

- Current API style is tRPC, not REST.
- Better Auth should remain the source of auth/session truth.
- Do not replace Better Auth with custom auth.
- For authenticated requests in browser, use Better Auth cookie/session flow.
- Do not assume manual Bearer token unless the existing codebase explicitly uses it.

---

## 3. Current Implementation Status

Completed:

- Phase 1–2:
  - project setup
  - database schema
  - category seed
  - paper library
  - paper detail
  - basic frontend UI

- Phase 3:
  - OpenAlex client
  - OpenAlex ingestion service
  - metadata normalization
  - deduplication
  - ingestion logs
  - admin ingestion endpoint

- Phase 3.5:
  - minimal admin auth
  - user/admin role
  - admin guard
  - removed temporary `x-admin-secret`

- Phase 4:
  - pure rule-based classifier
  - classification service
  - classify pending papers script
  - admin classification endpoints
  - published papers show in frontend

- Phase 5:
  - reading progress backend
  - bookmark backend
  - notes backend
  - frontend paper detail integration
  - reading mode page
  - manual progress slider
  - pause/save progress behavior

In progress:

- role-aware navbar
- user profile page
- notes overview page
- final Phase 5 UI polish

Deferred:

- Redis
- BullMQ
- workers
- scheduler/cron
- PDF parsing
- local PDF storage
- Unpaywall/Crossref integration
- admin monitoring dashboard UI
- production deployment
- advanced recommendations
- full analytics dashboard

---

## 4. Important MVP Technical Decisions

For the current MVP:

- Use manual admin-triggered ingestion, not scheduler.
- Use OpenAlex only for initial ingestion.
- Use metadata-only difficulty classification.
- Do not parse PDF files.
- Do not store PDF files locally.
- Users read via external source/PDF links.
- Reading progress is manually controlled by the user.
- Pause reading should not introduce a new status.
- Pause/save means:
  - keep status as `reading`
  - save current `progress_percentage`
  - update `last_read_at`

- Completed means:
  - status `completed`
  - progress `100`
  - set `completed_at`

- Do not use external AI/LLM APIs.
- Do not implement background jobs yet.
- Do not add new infrastructure unless explicitly requested.

---

## 5. Actual tRPC Procedure Paths

Existing or expected important procedures:

Admin ingestion:

- `admin.ingestion.runOpenAlex`
- `admin.ingestion.logs`

Admin classification:

- `admin.classification.runForPaper`
- `admin.classification.runBatch`
- `admin.classification.preview` if implemented

Reading progress:

- `reading.start`
- `reading.updateProgress`
- `reading.complete`
- `reading.getForPaper`

Bookmark:

- `bookmark.list`
- `bookmark.add`
- `bookmark.remove`
- `bookmark.getForPaper`

Notes:

- `notes.listForPaper`
- `notes.create`
- `notes.update`
- `notes.delete`

Profile, if implemented:

- prefer `profile.getOverview`

If actual paths differ, follow the existing router convention and report the actual paths in the summary.

---

## 6. Current Routes

Existing or expected frontend routes:

Public:

- `/`
- `/papers`
- `/papers/[id]`

Authenticated user:

- `/papers/[id]/read`
- `/profile`
- later: `/notes`

Admin:

- Use only existing admin route(s).
- Do not show admin links in navbar unless the target admin page actually exists.
- Do not show links that only lead to no-access pages.

---

## 7. Auth and Role Behavior

Auth provider:

- Better Auth

Roles:

- `user`
- `admin`

Expected behavior:

- Guest users can browse public pages.
- Guest users cannot access reading mode, profile, bookmarks, notes, or admin procedures.
- Normal users can manage only their own:
  - reading progress
  - bookmarks
  - notes
  - profile overview

- Admin users can access admin-protected procedures/pages.
- Admin users may also use normal user features if the UI supports it.
- Do not expose other users' private data.

Important:

- Check actual session shape before implementing role checks.
- Do not assume the role location.
- Inspect existing admin guard and session helper.
- Do not use `x-admin-secret`.
- Do not create a separate auth system.

---

## 8. Navbar Rules

Create or maintain a custom role-aware app navbar.

Do not rely on a hardcoded starter navbar that shows the same links for every user.

Guest navbar:

- Home
- Papers
- Login
- Register only if a real registration route exists

Normal user navbar:

- Papers
- Profile
- Notes only after notes overview page exists
- Logout

Admin navbar:

- Papers
- Admin link only if the route exists
- Profile optional
- Logout

Do not show:

- dashboard links to normal users
- admin links to normal users
- broken links
- links that only show "no access"

Logout:

- use Better Auth sign-out behavior
- after logout, redirect to public home or papers page
- navbar must update after logout

---

## 9. Data Model Summary

Important models:

- users
- categories
- papers
- paper_sources
- paper_classifications
- reading_progress
- bookmarks
- reading_notes
- ingestion_logs

Papers:

- status: `pending`, `published`, `rejected`
- only `published` papers should appear in user-facing paper library

Difficulty:

- `beginner_friendly`: 80–100
- `moderate`: 60–79
- `difficult`: 40–59
- `expert`: 0–39

Reading progress:

- status: `not_started`, `reading`, `completed`
- progress percentage: 0–100

---

## 10. UI Direction

Use a calm academic reading interface.

Visual direction:

- academic blue primary color
- warm neutral background
- white cards
- subtle borders
- readable typography
- clean spacing
- minimal distraction
- no flashy AI startup aesthetic
- no heavy glassmorphism on paper cards

Important:

- Paper library should clearly show difficulty level, beginner score, category, and estimated reading time.
- Paper detail should clearly show abstract, classification reason, warning, source/PDF actions, bookmark, and reading actions.
- Reading mode should be focused and distraction-free.
- Profile page should be simple, useful, and not analytics-heavy yet.

---

## 11. Performance and Stability Notes

Recent issue:

- Next dev server hit V8 out-of-memory while idle on paper detail.
- No frontend infinite loop was confirmed.
- Mitigation:
  - use `next dev --webpack --port 3001`
  - bounded React Query cache
  - disable focus refetch
  - reduce retries
  - remove always-mounted React Query Devtools
  - avoid duplicate session subscriptions

Important for future changes:

- Avoid `refetchInterval`.
- Avoid mutation/refetch loops.
- Avoid copying query data into local state unless necessary.
- Avoid repeated session subscriptions in many child components.
- Do not return raw OpenAlex metadata to frontend.
- Do not return `paper_sources.raw_metadata` to frontend.
- Keep frontend payloads compact.
- Check Network tab for repeated unnecessary tRPC calls after UI changes.

---

## 12. Development Notes

Local development:

- Web dev should use webpack mode:
  - `next dev --webpack --port 3001`

- Backend/server runs through the existing monorepo dev command.
- Use existing package scripts where possible.

Database:

- Supabase PostgreSQL
- Use existing Prisma client from `packages/db`
- Do not run migrations unless schema changes are explicitly required

OpenAlex:

- endpoint:
  - `admin.ingestion.runOpenAlex`

- imported papers usually enter as `pending`
- classification publishes them after successful classification

Classification:

- dev script exists for classifying pending papers
- metadata-only classifier
- no PDF parsing

Testing priority:

- guest browsing
- normal user reading flow
- bookmark add/remove
- notes CRUD
- reading mode progress save
- admin guard
- no repeated tRPC request loops
