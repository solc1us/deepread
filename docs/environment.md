# Environment Contract

DeepRead runs as `browser -> Express API -> PostgreSQL`. The web and API origins must be configured explicitly; wildcard CORS and implicit preview-domain trust are not supported.

## Local Development

Copy `apps/server/.env.example` to `apps/server/.env` and `apps/web/.env.example` to `apps/web/.env`.

Server-only values:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled PostgreSQL runtime connection used by Prisma. |
| `DIRECT_URL` | Direct PostgreSQL connection used by Prisma migrations and validation. |
| `BETTER_AUTH_SECRET` | Private Better Auth signing secret, at least 32 characters. |
| `BETTER_AUTH_URL` | Exact Express API origin, for example `http://localhost:3000`. |
| `CORS_ORIGIN` | Exact web origin, for example `http://localhost:3001`. |
| `PORT` | Standalone Express port; defaults to `3000`. |
| `NODE_ENV` | `development`, `test`, or `production`. |

Optional server settings are `OPENALEX_API_KEY`, `OPENALEX_BASE_URL`, `CLASSIFICATION_PROFILING`, and `OPENALEX_INGESTION_PROFILING`. The optional `ADMIN_*` values are retained only for the existing development seed; Phase 11.6A does not create or promote an administrator.

Browser-visible value:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SERVER_URL` | Exact Express API origin used by Better Auth and tRPC. |

Database URLs and `BETTER_AUTH_SECRET` must never use a `NEXT_PUBLIC_` prefix. Credentialed browser requests require `NEXT_PUBLIC_SERVER_URL` to address the API and `CORS_ORIGIN` to exactly match the web origin. Production and preview origins must use explicit HTTPS values.

## Integration And E2E

Copy `.env.test.example` to the ignored `.env.test.local`. Database-backed tests require `TEST_DATABASE_URL`, `TEST_DIRECT_URL` where specified, and `DEEPREAD_TEST_DATABASE_CONFIRMATION=deepread-test-only`. The guarded harness rejects missing confirmation and connections matching development URLs. Normal `bun test` and `bun run validate` remain database-free.

## Preview And Production

Configure the server-only variables on the API deployment and `NEXT_PUBLIC_SERVER_URL` on the web deployment. Use a pooled Supabase connection for `DATABASE_URL`; keep `DIRECT_URL` outside Vercel for the separate manual migration workflow. Generate a unique production `BETTER_AUTH_SECRET`; placeholder secrets and local API, web, or database origins are rejected by production validation and builds.

Development and production database targets must remain separate. The existing cloud Supabase project is development-only; the owner will create and configure a separate empty production project manually. See [`production-database.md`](production-database.md) for the guarded migration workflow. No Supabase or Vercel setting is changed by this contract.

## MVP Authentication Limits

- Users can register with email and password.
- Email ownership is not verified in the MVP.
- Forgotten passwords cannot be recovered automatically in the MVP.
- The existing administrator account is unchanged.
