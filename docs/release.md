# DeepRead Version 1 Release

| Item | Value |
| --- | --- |
| Product | DeepRead |
| Version | 1 |
| Release date | 24 July 2026 |
| Status | Released to production |
| Web | [https://deepread-academic.vercel.app/](https://deepread-academic.vercel.app/) |
| API | [https://deepread-academic-api.vercel.app/](https://deepread-academic-api.vercel.app/) |

## Included

- Published paper library with search, filters, sorting, pagination, and detail.
- Better Auth email/password registration and authenticated reader sessions.
- Reading mode, progress, completion, bookmarks, notes, profile, and statistics.
- Admin OpenAlex ingestion and `rule-based-v2.1.4` classification.
- Pending, needs-review, published, rejected, and inactive paper workflows.
- Admin monitoring, logs, data-quality audits, issue drill-downs, metadata
  remediation, manual classification, and safe duplicate resolution.

## Architecture

```text
Browser
  -> Next.js web
  -> same-origin /api/auth/* and /trpc/*
  -> Next.js external rewrites
  -> Express API
  -> Prisma
  -> Supabase PostgreSQL
```

The web and API are separate Vercel projects. Client route guards provide UX;
tRPC session ownership and the database-backed admin guard remain the security
boundaries.

## Validation Evidence

| Check | Result |
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

## Deployment Status

Version 1 is available at the production URLs above. The Next.js web project
uses the same-origin auth/tRPC proxy, and the Express API remains independently
health-checkable. Database migrations remain a separate guarded owner
operation and do not run during Vercel build or startup.

## Known Limitations

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
- Login and registration visual refinement remains planned post-release work.

## Post-Release Priorities

- Monitor API duration, readiness, request IDs, and admin pipeline logs.
- Keep initial pipeline batches conservative and increase only from measured
  production evidence.
- Verify database backup/recovery and Supabase security controls regularly.
- Improve Indonesian-language classifier coverage using evaluated changes.
- Refine login and registration presentation without changing auth boundaries.

## Rollback And Operations

Detailed procedures are maintained separately:

- [MVP operations and smoke checks](operations.md)
- [Production database migration and recovery](production-database.md)
- [Vercel deployment and application rollback](vercel-deployment.md)

## Final Release Checklist

- [x] Version and release date recorded.
- [x] Production web and API URLs recorded.
- [x] Unit, component, integration, and E2E evidence recorded.
- [x] Web and server production builds passed.
- [x] Prisma generation and schema validation passed.
- [x] Preview deployment rehearsal passed.
- [x] Production smoke testing passed.
- [x] Known MVP limitations documented.
- [x] Operations, database recovery, and Vercel rollback references linked.
