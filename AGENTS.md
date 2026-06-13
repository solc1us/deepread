Be concise and implementation-focused.

Project guidance:

* Use Bun commands (`bun`, `bun run`, `bunx --bun`) for installs, scripts, Prisma, and tooling.
* Respect the monorepo structure:
  * `apps/web` for the Next.js frontend.
  * `apps/server` for the Express backend.
  * `packages/db` for Prisma schema, generated client, migrations, and seed data.
  * `packages/auth`, `packages/api`, `packages/ui`, `packages/env`, and `packages/config` for shared concerns.
* Do not remove Better Auth generated models or generated Prisma configuration.
* Keep database models and Prisma conventions in `packages/db`.
* Keep reusable types/constants in shared packages when they already exist.
* Use Prisma model naming, relations, indexes, uniqueness constraints, timestamps, and `Json` fields consistently.
* For this phase, focus only on initial database models and seeding.
* Do not implement ingestion, classifier, worker, frontend pages, or API routes unless explicitly requested.
