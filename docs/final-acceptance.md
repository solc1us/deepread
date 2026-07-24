# DeepRead Version 1 Final Acceptance

## 1. Release Summary

| Item | Value |
| --- | --- |
| Product | DeepRead |
| Version | 1 |
| Release date | 24 July 2026 |
| Status | Accepted and released |
| Web | [https://deepread-academic.vercel.app/](https://deepread-academic.vercel.app/) |
| API | [https://deepread-academic-api.vercel.app/](https://deepread-academic-api.vercel.app/) |
| Git commit | `d8cabf0e1a2ba55230a9bbe89228fa76eadc20a9` |

## 2. Functional Acceptance

The production release provides:

- the public paper library, search, filters, sorting, pagination, and paper
  detail;
- registration, login, session persistence, and logout;
- profile, bookmarks, reading progress, notes, and statistics;
- OpenAlex ingestion and rule-based difficulty classification;
- the needs-review workflow and metadata remediation;
- safe duplicate keep-both and merge resolution;
- the admin dashboard, paper monitoring, pipeline controls, and logs.

## 3. Security Acceptance

- Browser authentication and tRPC traffic use the web origin through
  same-origin routes.
- Better Auth remains the session source.
- Private data ownership is derived from the server session.
- Database-backed admin authorization remains authoritative.
- User IDs and roles supplied by clients are not trusted for authorization.
- No application secrets are committed or exposed to browser code.
- Raw database errors and raw provider metadata are not exposed to clients.
- Authentication, proxy, CORS, and trusted-origin configuration use exact
  origins rather than wildcards.

## 4. Database Acceptance

- Development, isolated test, and production databases are separated.
- Checked-in production migrations are up to date.
- The application runtime uses the pooled `DATABASE_URL`.
- `DIRECT_URL` is reserved for guarded migration and direct administration.
- Migrations do not run during Vercel build or application startup.
- Production does not use `prisma db push`.
- Category seed data exists.
- Small production ingestion and classification runs succeeded.

See [Production Database](production-database.md) for migration, backup, and
recovery procedures.

## 5. Deployment Acceptance

- The production web deployment is reachable.
- API `/health` and `/ready` return successful responses.
- Authentication persists after refresh.
- User and admin access behave according to their current server-side roles.
- `/admin/logs` is deployed.
- Authentication and tRPC responses are not publicly cached.
- No redirect loop or CORS failure remains.

See [Vercel Deployment](vercel-deployment.md) and
[MVP Operations](operations.md) for deployment, smoke-check, request-ID, and
rollback procedures.

## 6. Validation Evidence

| Check | Verified result |
| --- | --- |
| Web component tests | 25 passed |
| Unit/component tests | 59 passed |
| Integration tests | 39 passed |
| Playwright E2E | 8 passed |
| Typecheck | Passed |
| Web production build | Passed |
| Server production build | Passed |
| Prisma generation and validation | Passed |
| Preview deployment rehearsal | Passed |
| Production smoke testing | Passed |

The final login and registration visual refinement was manually reviewed as a
presentation-only change. It did not change authentication logic, validation,
session handling, redirects, proxy behavior, or authorization. The automated
results above predate that final visual refinement and were not rerun for it.

## 7. Known Limitations

- Email verification is unavailable.
- Forgot-password and reset-password flows are unavailable.
- Administrator promotion is manual.
- Role changes may require session refresh or logout/login.
- Large ingestion and classification batches are constrained by Vercel
  Function duration.
- Difficulty classification remains rule-based.
- OpenAlex is the only implemented ingestion provider.
- Full-text PDF parsing is not implemented.
- Indonesian-language classification coverage is limited.

## 8. Final Decision

```text
Release decision: Accepted
Blocking issues: None
Known limitations: Documented
Version: 1
Release date: 24 July 2026
```

## 9. Post-Release Priorities

- Observe production errors and function duration.
- Improve login and registration visuals only if further polish is needed.
- Evaluate email verification and password recovery.
- Evaluate classifier accuracy using production data.
- Expand paper categories and provider coverage.

