# Plan Phase 11

## 11.1 Validation foundation dan CI

Kerjakan lebih dulu supaya seluruh perubahan berikutnya otomatis diperiksa.

Scope:

- tambahkan `check-types` ke web dan workspace penting;
- tambahkan root scripts:
  - `test`
  - `check-types`
  - `validate`
  - build web/server;
  - Prisma validate;

- buat GitHub Actions CI;
- CI tidak boleh memerlukan database development atau secret production.

Target:

```text
bun run validate
```

menjalankan test, typecheck seluruh workspace, build web/server, dan Prisma validate.

**1 prompt.**

[DONE]

---

## 11.2 Quick security dan error hardening

Tutup risiko kecil tetapi konkret sebelum test suite diperbesar.

Scope:

- beri batas panjang public search `q`, misalnya maksimum 200 karakter;
- pastikan FE dan BE memakai batas yang konsisten;
- sanitasi error batch classification agar Prisma message, local path, dan stack tidak masuk response;
- tambahkan focused tests untuk boundary input dan error mapping.

Rate limiting belum dipasang di kode sekarang karena lebih cocok ditentukan setelah deployment topology jelas. Audit hanya membuktikan input search belum dibatasi dan error classification bisa membocorkan runtime detail.

**1 prompt.**

---

## 11.3 Backend integration-test foundation

Ini bagian terbesar dan sebaiknya dibagi tiga.

### 11.3A — Database access strategy, RLS audit, and access-control tests

Buat:

- isolated PostgreSQL test database;
- `.env.test.example`;
- guard keras agar test tidak pernah memakai DB dev/production;
- migration + seed/cleanup test;
- tRPC caller dengan session guest, user, admin.
- RLS

Test:

- published paper bisa dibaca publik;
- unpublished paper terlihat sebagai not found;
- guest ditolak dari private/admin procedure;
- user ditolak dari admin;
- user tidak bisa mengakses data user lain;
- admin guard benar-benar memeriksa role database.

### 11.3B — User reading workflows

Test:

- reading start/update/complete;
- bookmark add/remove;
- note create/update/delete;
- grouped notes;
- statistics;
- ownership dan cross-user denial.

### 11.3C — Pipeline dan remediation

Test:

- ingestion normalization/dedupe;
- pagination di atas 100 tanpa memanggil OpenAlex asli;
- classification `published` dan `needs_review`;
- metadata remediation;
- manual classification;
- invalid status transition;
- keep-both duplicate;
- safe merge;
- bookmark/note/progress/source preservation;
- transaction rollback.

Audit menandai hampir seluruh critical backend flow belum punya coverage dan rollback belum pernah diuji terhadap database nyata.

**3 prompt.**

---

## 11.4 Reliability hardening

Dikerjakan setelah integration test tersedia supaya perubahannya bisa dibuktikan.

### 11.4A — Pipeline reliability

Perbaiki:

- overlapping classification batch;
- atomic claiming atau mekanisme setara agar dua batch tidak mengambil paper sama;
- ingestion-log finalization;
- log failure tidak boleh membuat hasil ingestion menjadi ambigu;
- fault-injection tests.

### 11.4B — Server lifecycle dan observability

Tambahkan:

- `PORT` dari environment;
- graceful `SIGINT` dan `SIGTERM`;
- stop menerima request baru;
- drain HTTP dengan timeout;
- Prisma disconnect;
- `/health` untuk liveness;
- `/ready` dengan bounded database check;
- request ID;
- sanitized structured error logs.

Saat ini server masih hardcoded port 3000, tidak punya graceful shutdown, dan health route belum mengecek readiness database.

**2 prompt.**

---

## 11.5 Frontend component dan E2E tests

### 11.5A — Component tests

Fokus ke komponen kompleks saja:

- paper filters;
- metadata editor;
- needs-review remediation;
- duplicate keep-both/merge;
- loading, validation, dan error state;
- cache invalidation.

Tidak perlu mengetes setiap card atau elemen visual sederhana.

### 11.5B — Playwright E2E

Critical journeys:

**Guest**

```text
browse papers
search/filter
open published paper
cannot open unpublished paper
cannot access authenticated/admin pages
```

**User**

```text
login
start reading
save progress
complete
bookmark
create/update/delete note
view statistics
cannot access admin
```

**Admin**

```text
login
open pipeline
open paper monitor
review needs_review paper
edit metadata
manual/rule-based classification
data-quality drill-down
duplicate keep-both/merge using seeded test data
```

OpenAlex harus di-mock; jangan melakukan ingestion eksternal nyata.

**2 prompt.**

---

## 11.6 Production environment dan database release

### 11.6A — Environment contract

Lengkapi:

```text
apps/server/.env.example
apps/web/.env.example
```

Dokumentasikan:

- `DATABASE_URL`;
- `DIRECT_URL`;
- `BETTER_AUTH_SECRET`;
- `BETTER_AUTH_URL`;
- `CORS_ORIGIN`;
- `NEXT_PUBLIC_SERVER_URL`;
- `PORT`;
- runtime pooled connection;
- migration/direct connection;
- profiling default `false`.

### 11.6B — Migration workflow

Tambahkan command:

```text
db:migrate:dev
db:migrate:deploy
db:generate
db:validate
```

Dokumentasikan:

```text
backup
migrate deploy
build/start
health/readiness check
failure handling
forward-fix or rollback procedure
```

Jangan gunakan `db:push` untuk production.

### Decision gate

Sebelum task deployment final, tentukan:

- frontend dan API satu domain atau berbeda;
- hosting frontend/backend;
- HTTPS URL final;
- apakah registrasi publik tetap dibuka;
- email verification;
- forgot/reset password;
- cara bootstrap admin pertama.

Audit memang menemukan environment, cookie/CORS, migration, dan kebijakan email/password belum punya kontrak production yang jelas.

**2 prompt setelah keputusan deployment.**

---

## 11.7 Deployment rehearsal

Gunakan environment production-like/disposable:

1. database kosong;
2. jalankan `migrate deploy`;
3. build web dan server;
4. start dengan production commands;
5. cek `/health` dan `/ready`;
6. login guest/user/admin;
7. cek cookie lintas origin;
8. smoke test tRPC;
9. kirim `SIGTERM`;
10. pastikan shutdown bersih dan bisa restart;
11. rehearse migration failure procedure.

Tidak menyentuh database production dulu.

**1 prompt + manual validation.**

---

## 11.8 Documentation dan final acceptance

Terakhir baru perbarui:

- README;
- `DOCUMENTATION.md`;
- setup lokal;
- test commands;
- environment;
- admin workflow;
- ingestion/classification;
- remediation;
- deployment;
- migration;
- rollback;
- known limitations.

Lalu jalankan final acceptance audit untuk memastikan:

```text
semua P1 selesai
critical tests hijau
CI hijau
production-like deployment lolos
tidak ada secret committed
docs bisa diikuti dari clean machine
```

**2 prompt:** documentation lalu final acceptance audit.

# Yang tidak perlu dikerjakan sekarang

Dua P3 tidak menjadi blocker:

- full in-memory Data Quality scan cukup dimonitor sampai dataset jauh lebih besar;
- warning `tsdown noExternal` bisa dibereskan saat tooling maintenance.

## Urutan final

```text
11.1 Validation scripts + CI
11.2 Search bound + error sanitization
11.3 Backend integration tests
11.4 Pipeline/server reliability
11.5 Component + E2E tests
11.6 Environment + migration contract
11.7 Production-like deployment rehearsal
11.8 Documentation + final acceptance
```

Totalnya sekitar **14 prompt kecil**, tetapi jauh lebih aman daripada satu prompt Phase 11 besar. Task berikutnya: **11.1 Validation foundation dan CI**.
