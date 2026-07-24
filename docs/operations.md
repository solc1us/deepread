# DeepRead MVP Operations

This guide covers the existing administrator and deployment operations. It
does not replace database backups, Vercel project controls, or Supabase
security review.

Current release details: [DeepRead Version 1](release.md).

## Admin Access

Admin UI routes require an authenticated Better Auth session. Every admin tRPC
procedure also uses the database-backed admin guard, so hiding or showing a
client route is not the authorization boundary.

Administrator promotion is manual. After a role change, refresh the session or
log out and log back in before relying on updated navigation. Never expose a
role-update endpoint to the browser.

## Pipeline

Use `/admin/pipeline` for OpenAlex ingestion and batch classification.

### OpenAlex Ingestion

1. Select the DeepRead category for imported papers.
2. Enter a focused free-text OpenAlex search query.
3. Start with a requested limit of `5-25` on Vercel Hobby.
4. Review fetched, saved, duplicate, invalid, and log-persistence results.
5. Check `/admin/logs` before increasing the limit.

The application accepts `1-500`, but that is a safety cap rather than an
operational recommendation. OpenAlex requests use pages of at most 100 and
database writes use bounded concurrency of 8. A retry is deduplicated by
normalized DOI and OpenAlex identifiers. A completed ingestion can report that
log finalization failed without treating already-committed paper writes as
failed.

Do not retry blindly after an ambiguous result. First check the paper monitor
and ingestion logs.

### Classification

1. Use a category filter when practical.
2. Start with `5-25` pending papers on Vercel Hobby.
3. Review published, needs-review, rejected, failed, and skipped/claimed
   results.
4. Increase the batch only after checking request duration and admin logs.

Classification uses bounded concurrency of 8 and atomically claims pending
papers so overlapping batches do not process the same paper. The production
classifier is `rule-based-v2.1.4`.

Outcomes:

- `classified`: save a complete classification and publish the paper.
- `needs_review`: do not save an incomplete classification; keep the paper for
  admin review.
- invalid/unusable input: follow the existing rejected or failure contract.

Inactive papers are not automatically reactivated or classified.

## Paper Review And Remediation

Use `/admin/papers` and filter by status. Open the admin paper detail route to
inspect unpublished metadata; never use the public paper route for this work.

### Needs Review

Available controlled actions:

- **Re-run classifier** uses the production v2.1.4 mapping. A classified result
  publishes; a quality-gate failure remains `needs_review`.
- **Manual classify and publish** requires a difficulty and meaningful review
  reason. It records `manual-admin-v1`, not rule-based provenance.
- **Reject** keeps the record but removes it from public visibility.
- **Set inactive** retains the paper and hides it from public access.

There is no direct publish bypass for an incomplete classification.

### Metadata

The shared metadata editor supports:

- authors;
- abstract;
- publication year;
- source URL;
- PDF URL.

Metadata edits do not automatically change classification or status. They
preserve the paper ID, sources, bookmarks, notes, and reading progress. Re-run
classification deliberately after correcting data that affected the quality
gate.

## Data Quality And Duplicates

Use `/admin/data-quality` for the permanent audit and
`/admin/data-quality/details` for supported drill-downs.

Duplicate-title matches are candidates only.

**Keep both**

- requires a review reason;
- does not modify either paper;
- records the exact group fingerprint as reviewed;
- allows a changed group membership to appear again.

**Merge duplicates**

- requires one selected paper to keep and at least one duplicate;
- preserves the selected paper's ID, metadata, and classification;
- moves or deduplicates unique sources, bookmarks, notes, and reading progress;
- records the resolution and admin audit entry in the merge transaction;
- marks duplicate papers `inactive`;
- never hard-deletes papers.

Review relation counts and source identifiers before confirming. Use keep-both
when the title match is not sufficient evidence.

## Logs And Troubleshooting

Use `/admin/logs` for persisted ingestion and admin action visibility. Pipeline
responses and unexpected server failures are sanitized.

Every Express response includes `x-request-id`. For a failed request:

1. Record the request ID, route, time, and visible status.
2. Check Vercel API logs for the same request ID.
3. Use only the sanitized operation and error type for diagnosis.
4. Do not paste cookies, auth tokens, database URLs, abstracts, note contents,
   or raw OpenAlex metadata into logs or tickets.

Health checks:

```text
GET https://<api-domain>/health
GET https://<api-domain>/ready
```

- `/health` is liveness-only and does not query PostgreSQL.
- `/ready` performs a two-second bounded database check.
- A readiness failure returns `503` without Prisma or connection details.

## Database Migrations

Migrations are manual owner operations, separate from Vercel:

```bash
bun run db:migrate:status
bun run db:migrate:deploy
bun run db:validate
bun run db:smoke
```

Before a production deploy:

```powershell
$env:DEEPREAD_DATABASE_TARGET="production"
$env:DEEPREAD_PRODUCTION_MIGRATION_CONFIRMATION="deploy-deepread-production"
```

Use the pooled production connection as `DATABASE_URL` and the matching direct
connection as `DIRECT_URL`. Confirm the sanitized host/database summary before
continuing. Never use `db push`, `migrate reset`, or an automatic seed against
production.

See [Production Database Workflow](production-database.md) for the full
rehearsal and recovery sequence.

## Production Smoke Test

After migration and deployment:

1. Verify API `/health` returns `200`.
2. Verify API `/ready` returns `200`.
3. Open the web application and confirm same-origin `/api/auth/*` and `/trpc/*`
   requests.
4. Register or sign in with a production test account.
5. Verify published paper browse, search, detail, and source links.
6. Verify profile, reading progress, bookmark, note, and statistics behavior.
7. Verify a normal user cannot open admin pages or call admin procedures.
8. Verify the administrator can open dashboard, papers, logs, and data quality.
9. Run only a `5-25` item ingestion/classification rehearsal if needed.
10. Confirm no unexpected external browser requests or client-side secrets.

## Recovery

- Application rollback: promote the previous healthy Vercel deployment.
- Database recovery: use the prepared Supabase backup/recovery point where
  available, or apply a reviewed forward migration.
- Do not assume application rollback reverses a database migration.
- Stop write operations when schema compatibility is uncertain.
