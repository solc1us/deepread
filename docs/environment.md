# Environment Contract

DeepRead runs as `browser -> Next.js same-origin proxy -> Express API -> PostgreSQL`. The web and API origins must be configured explicitly; wildcard CORS and implicit preview-domain trust are not supported.

## Local Development

Copy `apps/server/.env.example` to `apps/server/.env` and `apps/web/.env.example` to `apps/web/.env`.

Server-only values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL runtime connection used by Prisma. |
| `DIRECT_URL` | Direct PostgreSQL connection used by guarded migrations and database checks. |
| `BETTER_AUTH_SECRET` | Private Better Auth signing secret, at least 32 characters. |
| `BETTER_AUTH_URL` | Exact browser-facing web origin, for example `http://localhost:3001`. |
| `CORS_ORIGIN` | Exact web origin, for example `http://localhost:3001`. |
| `PORT` | Standalone Express port; defaults to `3000`. |
| `NODE_ENV` | `development`, `test`, or `production`. |

Optional server settings are `OPENALEX_API_KEY`, `OPENALEX_BASE_URL`, `CLASSIFICATION_PROFILING`, and `OPENALEX_INGESTION_PROFILING`. The optional `ADMIN_*` values are retained only for the existing development seed; Phase 11.6A does not create or promote an administrator.

Web project values:

| Variable | Purpose |
| --- | --- |
| `API_UPSTREAM_URL` | Server-only Express origin used by Next.js rewrites, for example `http://localhost:3000`. |
| `NEXT_PUBLIC_SERVER_URL` | Browser-visible web origin retained for explicit production-origin validation. |

Browser requests use relative `/api/auth/*` and `/trpc/*` paths. Next.js proxies them to `API_UPSTREAM_URL`; that server-only value must never enter client code. `BETTER_AUTH_URL`, `CORS_ORIGIN`, and `NEXT_PUBLIC_SERVER_URL` use the exact web origin. Database URLs and `BETTER_AUTH_SECRET` must never use a `NEXT_PUBLIC_` prefix. Production and preview origins must use explicit HTTPS values.

Better Auth cookies are created through the web-origin proxy with `httpOnly`,
`SameSite=Lax`, and `Secure` in production. Origin and CSRF checks remain
enabled. Route guards wait for a successful session check and provide UX only;
tRPC session ownership and the database-backed admin guard remain authoritative.

## Integration And E2E

Copy `.env.test.example` to the ignored `.env.test.local`. Database-backed tests require `TEST_DATABASE_URL`, `TEST_DIRECT_URL` where specified, and `DEEPREAD_TEST_DATABASE_CONFIRMATION=deepread-test-only`. The guarded harness rejects missing confirmation and connections matching development URLs. Normal `bun test` and `bun run validate` remain database-free.

`bun run test:integration:migrate` applies only checked-in migrations to the
confirmed test database. Integration and E2E fixtures use unique run
identifiers and remove only test-owned records. The E2E runner starts local web
and API processes, uses one Chromium worker, and blocks unexpected browser
origins.

## Preview And Production

Configure the API variables on the API deployment. Configure `API_UPSTREAM_URL` and `NEXT_PUBLIC_SERVER_URL` on the web deployment. Use a pooled Supabase connection for `DATABASE_URL`; keep `DIRECT_URL` outside Vercel for the separate manual migration workflow. Generate a unique production `BETTER_AUTH_SECRET`; placeholder secrets and local API, web, or database origins are rejected by production validation and builds.

Development and production database targets must remain separate. The existing cloud Supabase project is development-only; the owner will create and configure a separate empty production project manually. See [`production-database.md`](production-database.md) for the guarded migration workflow. No Supabase or Vercel setting is changed by this contract.

## MVP Authentication Limits

- Users can register with email and password.
- Email ownership is not verified in the MVP.
- Forgotten passwords cannot be recovered automatically in the MVP.
- Administrator promotion is manual.
- Role changes may require a session refresh or logout/login.
