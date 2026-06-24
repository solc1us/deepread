# deepread

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Express, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **Express** - Fast, unopinionated web framework
- **tRPC** - End-to-end type-safe APIs
- **Bun** - Runtime environment
- **Prisma** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
bun install
```

## Database Setup

This project uses PostgreSQL with Prisma.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:

```bash
bun run db:push
```

Then, run the development server:

```bash
bun run dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
The API is running at [http://localhost:3000](http://localhost:3000).

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@deepread/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
deepread/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   └── server/      # Backend API (Express, TRPC)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `bun run dev`: Start all applications in development mode
- `bun run build`: Build all applications
- `bun run dev:web`: Start only the web application
- `bun run dev:server`: Start only the server
- `bun run check-types`: Check TypeScript types across all apps
- `bun run db:push`: Push schema changes to database
- `bun run db:generate`: Generate database client/types
- `bun run db:migrate`: Run database migrations
- `bun run db:studio`: Open database studio UI

## OpenAlex Ingestion

Manual OpenAlex ingestion is currently exposed through temporary secret-protected tRPC procedures:

- `admin.ingestion.runOpenAlex`
- `admin.ingestion.logs`

Set `ADMIN_INGESTION_SECRET` in `apps/server/.env`, then send it as the `x-admin-secret` header. This is a Phase 3 temporary guard and should be replaced by real admin auth later.

Imported OpenAlex papers are saved with `status = pending`, so they do not appear in the public paper library while the frontend only lists `published` papers. Classification and publishing happen in later phases.

Run a small manual ingestion from the repo root:

```bash
curl -X POST http://localhost:3000/trpc/admin.ingestion.runOpenAlex \
  -H "content-type: application/json" \
  -H "x-admin-secret: your-dev-secret" \
  --data '{"json":{"categoryId":"CATEGORY_UUID","query":"student learning","limit":3}}'
```

Check recent ingestion logs:

```bash
curl -X POST http://localhost:3000/trpc/admin.ingestion.logs \
  -H "content-type: application/json" \
  -H "x-admin-secret: your-dev-secret" \
  --data '{"json":{"limit":20}}'
```

DEV ONLY scripts are available for local checks and are not run automatically:

```bash
bun run --cwd apps/server dev:db-health
bun run --cwd apps/server dev:test-openalex
bun run --cwd apps/server dev:ingest-openalex
```
