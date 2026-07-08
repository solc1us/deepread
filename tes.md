Read AGENTS.md and CODEX_CONTEXT.md only.

Do not scan the full DOCUMENTATION.md unless a missing product decision blocks the task.

Phase 5 - Prompt 8/8: Final Phase 5 UI Polish and Integration QA

Task:

Polish the Phase 5 user-facing UI and run integration QA for reading progress, bookmarks, notes, profile, and reading mode.

Context:

- Reading progress backend works.

- Bookmark backend works.

- Notes backend works.

- Paper detail reading actions work.

- Reading mode with manual progress slider works.

- Profile page works.

- Notes overview page works.

- Notes overview now groups notes by paper.

- The current `/notes` page is functional but visually rough.

- The main UI issue is that paper title, paper metadata, and notes list are not visually separated enough.

- This prompt should focus on frontend polish and integration QA, not new product features.

Scope:

- Frontend UI/UX polish.

- Small backend response adjustments only if needed for cleaner UI.

- Do not modify database schema.

- Do not implement statistics dashboard.

- Do not implement admin monitoring dashboard.

- Do not modify ingestion/classification logic.

- Do not implement PDF parsing.

- Do not add Redis, workers, scheduler, or background jobs.

- Do not introduce new major features.

Primary focus: `/notes` page polish

Improve the grouped notes overview UI.

Current issue:

- One paper card contains multiple notes, but the hierarchy is not visually clear.

- Paper title and notes feel mixed together.

- Notes are separated mostly by lines, not by clean structure.

- Edit/delete actions feel visually detached.

- The page works, but it does not yet feel polished or easy to scan.

Desired UX:

- One outer card represents one paper.

- The paper header should be clearly separated from the notes list.

- Notes should be readable as individual note items inside the paper card.

- The page should be easy to scan even when a paper has many notes.

Recommended layout for each paper group:

1. Paper group card:
   - outer white/surface card

   - subtle border

   - comfortable padding

   - consistent spacing

   - no heavy glassmorphism

2. Paper header area:
   - paper title prominent

   - metadata badges below or above title:
     - category

     - difficulty level

     - beginner score

     - estimated reading time

     - note count

   - latest updated text should be smaller and muted

   - paper header should have a clear bottom border or spacing before notes

3. Notes section inside the paper card:
   - render each note as a smaller inner item/card or clearly separated block

   - each note should show:
     - section label if available

     - note text

     - created/updated date

     - edit/delete actions

   - note text should be readable and not too cramped

   - long notes should wrap nicely

   - avoid making every note look like a separate top-level paper card

4. Note actions:
   - Edit and Delete should be aligned consistently

   - Delete should use a subtle destructive style, not visually overpower the content

   - Actions can be placed on the top-right of each note item or at the bottom-right, whichever looks cleaner

   - Keep mobile responsiveness acceptable

5. Paper group actions:
   - View Paper

   - Continue Reading

   - Place these actions in a clear footer area of the paper card

   - Footer should feel connected to the paper card, not floating

   - Use consistent button styles with the rest of the app

6. Empty state:
   - Keep a clean empty state if the user has no notes

   - Include a link to browse papers

Secondary polish targets:

Review these pages lightly and only adjust obvious inconsistencies:

- `/papers`

- `/papers/[id]`

- `/papers/[id]/read`

- `/profile`

- navbar/header

Do not redesign the whole app.

Only make small consistency fixes:

- spacing

- button variants

- card padding

- badge style

- section hierarchy

- empty states

- loading states

- responsive layout issues

UI direction:

- Follow the calm academic reading interface from AGENTS.md.

- Use academic blue, warm neutral background, white/surface cards, subtle borders, readable typography, and clean spacing.

- Avoid flashy AI startup styling.

- Avoid heavy glassmorphism.

- Avoid overly dark or visually heavy cards if the rest of the app uses warm neutral/light academic style.

- Keep the interface readable and calm.

Additional UI consistency requirement:

Border radius consistency:

- Audit all visible buttons, nav actions, icon buttons, profile/avatar buttons, theme toggle buttons, cards, badges, inputs, textareas, and action buttons.

- Fix inconsistent border radius across the app.

- Some buttons currently have sharp 0-radius corners while similar buttons on other pages have rounded corners.

- Normalize border radius using the existing design system/token/component convention if available.

- Prefer updating shared UI components or shared class patterns instead of fixing every page manually one by one.

- Navbar theme toggle and profile/user menu buttons should not look like sharp square buttons unless that is the intentional global design.

- Keep button radius consistent across:
  - navbar

  - paper cards

  - paper detail actions

  - reading mode actions

  - profile page actions

  - notes page edit/delete/view/continue buttons

- Do not over-round everything.

- Match the app's calm academic card/button style.

- Ensure hover/focus states still look clean and accessible.

Auth/navbar QA:

1. Guest navbar:
   - public links only

   - no profile/notes/admin links

2. Normal user navbar:
   - Papers

   - Profile

   - Notes

   - Logout

   - no admin/dashboard links

3. Admin navbar:
   - show only working admin links

   - no broken/no-access links

4. Logout should update navbar state correctly.

Integration QA:

Test these flows:

1. Guest:
   - can open `/papers`

   - can open `/papers/[id]`

   - cannot access `/profile`

   - cannot access `/notes`

   - cannot access `/papers/[id]/read`

2. Normal user:
   - can start reading from paper detail

   - can continue reading

   - can save manual progress

   - can pause/save and exit

   - can mark completed

   - can bookmark and remove bookmark

   - can create notes from paper detail

   - can see grouped notes in `/notes`

   - can edit/delete notes from `/notes`

   - can see bookmarks, reading papers, and completed papers in `/profile`

3. Data persistence:
   - refresh paper detail after bookmark/progress changes

   - refresh reading mode after progress changes

   - refresh profile

   - refresh notes page

   - data should remain correct

4. Data isolation:
   - ensure notes/bookmarks/progress use current user only

   - do not expose other users' private data

5. Performance:
   - no repeated unnecessary tRPC requests while idle

   - no refetchInterval

   - no infinite refetch/mutation loop

   - no repeated session subscriptions in many child components

   - no raw OpenAlex metadata returned to frontend

Validation:

- Run typecheck/lint if available and reasonable.

- Do not run production build unless needed.

- Manually inspect responsive layout for `/notes`.

- Confirm `/notes` remains usable when:
  - one paper has one note

  - one paper has many notes

  - multiple papers have notes

  - notes have long text

  - notes have no section

Expected output:

- `/notes` grouped paper-card UI is cleaner and easier to scan.

- Paper header and notes list are visually separated.

- Notes inside each paper group look organized.

- View Paper and Continue Reading actions are placed cleanly.

- Phase 5 pages have consistent spacing, cards, buttons, badges, and empty states.

- No new major features added.

- Summary of changed files.

- Manual QA result.

- Any known limitations.
