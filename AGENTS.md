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

## UI/UX Design Direction

DeepRead should use a calm academic reading interface. The product should feel like a modern digital reading desk for students, not a flashy AI startup dashboard.

Core UI characteristics:

* calm
* academic
* focused
* readable
* trustworthy
* beginner-friendly
* low-distraction
* structured
* modern but not playful
* scholarly but not intimidating

Visual direction:

* Use warm neutral backgrounds.
* Use academic blue as the primary brand color.
* Use muted amber only as a subtle accent.
* Avoid neon colors, heavy gradients, excessive animation, and overly decorative visuals.
* Prioritize readability over visual effects.
* Use generous whitespace and soft borders.
* Prefer list-based paper cards over large ecommerce-like grids because papers are text-heavy content.

Recommended color palette:

* Background: #F8F6F0
* Surface/Card: #FFFFFF
* Text Primary: #1F2933
* Text Secondary: #667085
* Border: #E5E1D8
* Primary Academic Blue: #2F5D8C
* Primary Hover: #244B72
* Accent Muted Amber: #C9973F

Difficulty badge colors:

* Beginner Friendly: background #DDEFE6, text #2F6F5E
* Moderate: background #E8F0FA, text #2F5D8C
* Difficult: background #FFF1D6, text #9A5B13
* Expert: background #F8DDDD, text #9B2C2C

Typography direction:

* Use Inter for UI text, labels, body, buttons, and form controls.
* Use Source Serif 4 for major headings or paper titles if available.
* If Source Serif 4 is not configured yet, do not force it immediately; keep typography clean and readable.

Card style:

* Paper cards should prioritize readability.
* Use white surface, soft border, subtle shadow, and clear hierarchy.
* Avoid heavy glassmorphism on paper cards because it can reduce readability.
* Glassmorphism may be used only sparingly for hero panels, filter/search containers, or decorative background panels.
* If glassmorphism is used, keep it subtle:
  * light translucent background
  * soft blur
  * visible border
  * no strong glow
  * no low-contrast text

Layout principles:

* Paper Library should make difficulty level, beginner score, category, and estimated reading time visible immediately.
* Paper Detail should focus on title, abstract, difficulty explanation, reading warning, and source/PDF actions.
* Reading-related pages should use limited width, comfortable line height, and minimal distraction.
* Admin pages may be more dashboard-like, but should still follow the same palette and clean spacing.

Interaction principles:

* Keep animations subtle and functional.
* Avoid gamified UI unless explicitly requested.
* Use clear primary buttons for main actions such as View Details, Start Reading, Open Source, and Mark as Completed.
* Use badges for difficulty indicators.
* Use empty, loading, and error states consistently.

Moodboard keywords:

* calm academic
* modern library
* reading desk
* scholarly minimalism
* warm paper
* academic blue
* soft borders
* focused reading
* quiet interface
