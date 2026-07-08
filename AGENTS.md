# AGENTS.md

Be concise and implementation-focused.

Use this file for persistent project guidance.
Use `CODEX_CONTEXT.md` for current phase/status context.
Do not read the full `DOCUMENTATION.md` unless a missing product decision blocks the task.

---

## Project Commands

Use Bun commands:

- `bun`
- `bun run`
- `bunx --bun`

Use existing package scripts when available.

---

## Monorepo Structure

Respect the current monorepo structure:

- `apps/web` — Next.js frontend
- `apps/server` — Express backend
- `packages/db` — Prisma schema, generated client, migrations, seed data
- `packages/auth` — Better Auth setup
- `packages/api` — tRPC API/router logic
- `packages/ui` — shared UI components
- `packages/env` — shared environment validation
- `packages/config` — shared config

Do not move major systems across packages unless explicitly requested.

---

## Backend Rules

- Current API style is tRPC, not REST.
- Keep Better Auth as the auth/session source.
- Do not replace Better Auth with custom auth.
- Do not remove Better Auth generated models.
- Do not remove generated Prisma configuration.
- Keep database models and Prisma conventions in `packages/db`.
- Keep Prisma model naming, relations, indexes, uniqueness constraints, timestamps, and `Json` fields consistent.
- Reuse existing router/procedure/context utilities.
- Preserve existing tRPC procedure paths unless explicitly requested.
- `routers/index.ts` should remain the root router composer only.
- Do not add large feature logic blocks back into `routers/index.ts`.

---

## Auth and Security Rules

- Never trust `userId` from client input for private data.
- Always derive private user ownership from server session:
  - `ctx.session.user.id`
  - or the existing project equivalent

- User-private data must be scoped to the current user:
  - reading progress
  - bookmarks
  - notes
  - profile
  - statistics

- Admin procedures must use the existing admin guard.
- Do not use `x-admin-secret`.
- Do not enable Supabase RLS unless explicitly requested.
- Do not expose raw provider metadata to frontend.

---

## Current MVP Technical Decisions

- Use manual admin-triggered ingestion for now.
- Use OpenAlex as the active ingestion source.
- Use metadata-only difficulty classification.
- Do not parse PDF files.
- Do not store PDF files locally.
- Users read through external source/PDF links.
- Reading progress is manually controlled.
- Reading time in statistics is estimated, not real tracked duration.
- Do not use external AI/LLM APIs for classifier.
- Do not add Redis, BullMQ, workers, scheduler, or cron unless explicitly requested.

---

## Performance Rules

Avoid:

- `refetchInterval`
- mutation/refetch loops
- repeated session subscriptions in many child components
- copying query data into local state unless necessary
- returning raw OpenAlex metadata
- returning `paper_sources.raw_metadata`

Keep frontend payloads compact.

Local web development should use webpack mode:

- `next dev --webpack --port 3001`

---

## UI/UX Design Direction

DeepRead should use a calm academic reading interface.
The product should feel like a modern digital reading desk for students, not a flashy AI startup dashboard.

Core UI characteristics:

- calm
- academic
- focused
- readable
- trustworthy
- beginner-friendly
- low-distraction
- structured
- modern but not playful
- scholarly but not intimidating

Visual direction:

- Use warm neutral backgrounds.
- Use academic blue as the primary brand color.
- Use muted amber only as a subtle accent.
- Avoid neon colors, heavy gradients, excessive animation, and overly decorative visuals.
- Prioritize readability over visual effects.
- Use generous whitespace and soft borders.
- Use consistent border radius.
- Prefer list-based paper cards over large ecommerce-like grids.

Recommended color palette:

- Background: `#F8F6F0`
- Surface/Card: `#FFFFFF`
- Text Primary: `#1F2933`
- Text Secondary: `#667085`
- Border: `#E5E1D8`
- Primary Academic Blue: `#2F5D8C`
- Primary Hover: `#244B72`
- Accent Muted Amber: `#C9973F`

Difficulty badge colors:

- Beginner Friendly: background `#DDEFE6`, text `#2F6F5E`
- Moderate: background `#E8F0FA`, text `#2F5D8C`
- Difficult: background `#FFF1D6`, text `#9A5B13`
- Expert: background `#F8DDDD`, text `#9B2C2C`

Typography:

- Use Inter for UI text, labels, body, buttons, and form controls.
- Use Source Serif 4 for major headings or paper titles if already configured.
- If Source Serif 4 is not configured, do not force it.

Card style:

- Paper cards should prioritize readability.
- Use white surface, soft border, subtle shadow, and clear hierarchy.
- Avoid heavy glassmorphism on paper cards.
- Glassmorphism may be used only sparingly for hero panels, search/filter containers, or decorative panels.

Layout principles:

- Paper Library should show difficulty level, beginner score, category, and estimated reading time clearly.
- Paper Detail should focus on title, abstract, classification reason, reading warning, and source/PDF actions.
- Reading pages should use limited width, comfortable line height, and minimal distraction.
- Profile, Notes, and Statistics pages should stay useful but not visually crowded.
- Admin pages may be more dashboard-like, but should still follow the same palette and clean spacing.

Interaction principles:

- Keep animations subtle and functional.
- Avoid gamified UI unless explicitly requested.
- Use clear primary buttons for main actions.
- Use badges for difficulty indicators.
- Use empty, loading, and error states consistently.
- Do not show broken links or links that only lead to no-access pages.

Moodboard keywords:

- calm academic
- modern library
- reading desk
- scholarly minimalism
- warm paper
- academic blue
- soft borders
- focused reading
- quiet interface
