# DeepRead Product Requirements Document

## Release Information

| Item | Detail |
| --- | --- |
| Product | DeepRead |
| Document | Product Requirements Document |
| Version | 1 |
| Release Date | 24 July 2026 |
| Status | Production |
| Web Application | https://deepread-academic.vercel.app/ |
| API | https://deepread-academic-api.vercel.app/ |

---

# 1. Product Overview

DeepRead adalah web application yang membantu mahasiswa menemukan, memilih, dan membaca paper akademik open-access berdasarkan tingkat kesulitan dan kesiapan pembaca.

Produk ini dibuat untuk mengatasi tiga masalah utama ketika mahasiswa mulai membaca paper akademik:

1. terlalu banyak pilihan paper;
2. sulit menentukan paper yang cocok untuk pembaca pemula;
3. pembaca cepat menyerah karena paper yang dipilih terlalu teknis.

DeepRead tidak menggantikan proses membaca dengan ringkasan instan. Produk ini membantu pengguna menemukan paper yang sesuai, memahami tingkat kesulitannya sebelum membaca, menyimpan progress, membuat catatan, dan membangun kebiasaan membaca akademik.

Paper dikumpulkan melalui OpenAlex, dinormalisasi, diperiksa kelengkapan metadatanya, dideduplikasi, lalu diklasifikasikan menggunakan rule-based difficulty classifier. Paper hanya tersedia untuk pengguna setelah memenuhi quality gate dan berstatus `published`.

Admin tidak melakukan upload paper satu per satu. Admin mengoperasikan ingestion, classification, review `needs_review`, metadata remediation, duplicate resolution, dan monitoring log melalui dashboard.

## Product Positioning

Platform academic reading yang menggabungkan automated paper ingestion, transparent difficulty classification, dan personal reading tools untuk membantu mahasiswa menemukan paper open-access yang sesuai dengan tingkat kesiapan baca mereka.

## Core Product Statement

DeepRead membantu mahasiswa memilih paper yang tepat, mulai membaca dengan lebih percaya diri, dan membangun kebiasaan membaca akademik melalui pengalaman yang sederhana, terarah, dan ramah untuk pemula.

## Version 1 Definition

Version 1 adalah web application production yang menyediakan:

- paper library open-access;
- search, filter, sorting, dan pagination;
- transparent difficulty classification;
- paper detail dan reading mode;
- bookmark, reading progress, notes, dan statistics;
- automated OpenAlex ingestion;
- admin monitoring dan remediation workflow;
- secure role-based access;
- deployment web dan API terpisah di Vercel;
- PostgreSQL production database di Supabase.

---

# 2. Vision and Goals

## Vision

Menjadi personal academic reading tool yang membantu mahasiswa membangun kebiasaan membaca sumber akademik asli melalui pemilihan paper yang lebih terkurasi, klasifikasi tingkat kesulitan yang transparan, dan pengalaman membaca yang mudah digunakan.

## Goals

| Goal | Description |
| --- | --- |
| Membantu pemilihan paper | Membantu mahasiswa menemukan paper open-access yang sesuai untuk pembaca pemula |
| Mengurangi information overload | Mengurangi kebingungan akibat terlalu banyak pilihan paper |
| Menjelaskan difficulty | Memberikan indikator tingkat kesulitan, skor, alasan, dan reading warning |
| Meningkatkan reading engagement | Membantu pengguna memulai, melanjutkan, dan menyelesaikan bacaan |
| Membentuk kebiasaan membaca | Menyediakan progress, bookmark, notes, dan statistics |
| Mengotomatisasi pengumpulan paper | Mengurangi kebutuhan input paper secara manual |
| Menjaga kualitas library | Menyediakan quality gate, remediation, dan duplicate resolution |
| Menjaga data pengguna | Memastikan data privat dan admin dilindungi oleh session, ownership, dan role checks |

---

# 3. Users, Pain Points, and Value Proposition

## User Roles

| Role | Access |
| --- | --- |
| Guest | Landing page, paper library, search, filter, paper detail, register, dan login |
| User | Seluruh akses guest serta bookmark, reading progress, notes, profile, dan statistics |
| Admin | Seluruh akses user serta ingestion, classification, paper monitoring, remediation, data quality, duplicate resolution, dan logs |

## User Problem

| Aspect | Description |
| --- | --- |
| Primary User | Mahasiswa yang ingin membaca paper akademik tetapi kesulitan memilih bacaan yang sesuai |
| Main Pain Point | Paper sulit dibandingkan, abstract terasa teknis, dan tingkat kesulitan tidak terlihat sebelum membaca |
| User Need | Library paper yang dapat dicari dan difilter berdasarkan kategori serta difficulty |
| Value Proposition | Paper open-access diklasifikasikan secara transparan dan dilengkapi reading tools |
| Expected Outcome | Pengguna lebih mudah memulai membaca, menyelesaikan lebih banyak paper, dan membangun kebiasaan membaca akademik |

---

# 4. Version 1 Scope

## Implemented Features

| Feature | Description | Status |
| --- | --- | --- |
| Public Registration | Pengguna dapat mendaftar menggunakan nama, email, dan password | Implemented |
| Authentication | Login, session persistence, logout, dan protected routes | Implemented |
| User Profile | Menampilkan informasi akun dan ringkasan aktivitas | Implemented |
| Paper Library | Menampilkan paper berstatus `published` | Implemented |
| Search, Filter, and Sort | Search keyword, category, difficulty, sorting, dan pagination | Implemented |
| Paper Detail | Metadata, abstract, classification, source, dan user reading state | Implemented |
| Reading Mode | Tampilan fokus untuk membaca abstract dan metadata paper | Implemented |
| Reading Progress | Start, update percentage, dan complete reading | Implemented |
| Bookmark | Add, list, dan remove bookmark | Implemented |
| Reading Notes | Create, list, update, dan delete notes per paper | Implemented |
| Reading Statistics | Total aktivitas, completion, category, dan difficulty distribution | Implemented |
| OpenAlex Ingestion | Manual admin-triggered metadata ingestion | Implemented |
| Metadata Validation | Validasi title, abstract, source, category, dan metadata minimum | Implemented |
| Deduplication | DOI, external ID, in-batch deduplication, dan duplicate-title review | Implemented |
| Difficulty Classification | Rule-based classifier `rule-based-v2.1.4` | Implemented |
| Needs-Review Workflow | Quality gate untuk paper yang belum layak dipublikasikan | Implemented |
| Metadata Remediation | Admin dapat memperbaiki metadata dan authors | Implemented |
| Manual Classification | Admin dapat memberikan classification dengan provenance `manual-admin-v1` | Implemented |
| Duplicate Resolution | Keep both atau safe merge tanpa hard delete | Implemented |
| Admin Monitoring | Dashboard, paper monitor, data quality, classification, pipeline, dan logs | Implemented |
| Health and Readiness | `/health` dan `/ready` pada API | Implemented |
| Production Deployment | Next.js web dan Express API di Vercel, PostgreSQL di Supabase | Implemented |

## Future Scope

| Feature | Description |
| --- | --- |
| Personalized Recommendation | Rekomendasi berdasarkan riwayat dan minat pengguna |
| Reading Queue | Daftar bacaan terurut |
| AI Guiding Questions | Pertanyaan pemantik sebelum membaca |
| Learning Path | Urutan paper berdasarkan topik dan tingkat kesulitan |
| User Difficulty Feedback | Feedback apakah paper terlalu mudah atau sulit |
| Citation Support | Bantuan format sitasi |
| Export Notes | Export catatan pengguna |
| Community Reading Group | Grup diskusi paper |
| Email Verification | Verifikasi kepemilikan email |
| Password Recovery | Forgot password dan reset password |
| Scheduled Ingestion | Ingestion terjadwal tanpa trigger admin |
| Additional Providers | Unpaywall, Crossref, CORE, arXiv, PubMed Central, dan DOAJ |
| Full-Text Processing | Parsing dan classification menggunakan full text legal |
| Background Job Infrastructure | Queue dan worker untuk batch besar |
| Login/Register Visual Refinement | Penyempurnaan visual halaman login dan register setelah release |

---

# 5. Automated Paper Ingestion

## Current Source

Version 1 menggunakan OpenAlex sebagai sumber metadata utama.

| Source | Status | Function |
| --- | --- | --- |
| OpenAlex | Implemented | Metadata paper, authors, abstract reconstruction, DOI, source, year, dan open-access information |
| Unpaywall | Future | Validasi dan enrichment legal full-text links |
| Crossref | Future | DOI metadata enrichment |
| CORE | Future | Additional open-access source |
| arXiv | Future | Preprint source |
| PubMed Central | Future | Biomedical open-access source |
| DOAJ | Future | Open-access journal directory |

## Ingestion Flow

```text
Admin selects category, query, and limit
↓
OpenAlex metadata request
↓
Pagination with maximum page size 100
↓
Metadata normalization and validation
↓
DOI, external-ID, and in-batch deduplication
↓
Paper and source persistence
↓
Classification pipeline
↓
Quality gate
├─ complete and valid → published
└─ incomplete or low confidence → needs_review
↓
Ingestion log finalization
```

## Current Operational Constraints

| Item | Current Behavior |
| --- | --- |
| Application limit | 1–500 papers per request |
| OpenAlex internal page size | Maximum 100 |
| Ingestion write concurrency | 8 |
| Recommended initial production batch | 5–25 papers |
| Trigger | Manual admin action |
| Scheduler | Not implemented |
| Queue/worker | Not implemented |
| External API during tests | Blocked or mocked |

## Minimum Paper Requirements

| Requirement | Description |
| --- | --- |
| Title | Required |
| Abstract | Required for classification |
| Source | At least one valid source |
| Category | Required |
| Open-access information | Legal source or open-access metadata must be available |
| Classification | Complete classification must exist before publication |
| Quality gate | Paper must pass metadata and classification requirements |
| Duplicate handling | Paper must not conflict with an existing DOI or external ID |

---

# 6. Difficulty Classification

## Description

DeepRead menggunakan rule-based difficulty classification agar hasil dapat dijelaskan, diuji, dan diaudit tanpa external AI or LLM API.

Current production classifier:

```text
rule-based-v2.1.4
```

Manual administrator classification provenance:

```text
manual-admin-v1
```

## Classification Input

| Input | Description |
| --- | --- |
| Title | Judul paper |
| Abstract | Abstract paper |
| Keywords | Keywords jika tersedia |
| Category | Bidang paper |
| Publication Metadata | Tahun, source, DOI, dan authors |
| Metadata Completeness | Kelengkapan metadata minimum |

## Classification Output

| Output | Description |
| --- | --- |
| Difficulty Level | `beginner_friendly`, `moderate`, `difficult`, atau `expert` |
| Beginner Score | Skor 0–100 |
| Estimated Reading Time | Estimasi waktu baca dalam menit |
| Classification Reason | Alasan hasil classification |
| Reading Warning | Bagian atau konsep yang berpotensi sulit |
| Recommended Reader | Profil pembaca yang sesuai |
| Classification Version | Versi classifier atau provenance manual |

## Difficulty Level

| Level | Score Range | Description |
| --- | ---: | --- |
| Beginner Friendly | 80–100 | Cocok untuk mahasiswa yang baru mulai membaca paper |
| Moderate | 60–79 | Memerlukan pengetahuan dasar |
| Difficult | 40–59 | Memerlukan pemahaman konsep atau metode tertentu |
| Expert | 0–39 | Sangat teknis dan kurang sesuai untuk pembaca pemula |

## Classification Indicators

| Indicator | Description |
| --- | --- |
| Abstract Length | Abstract panjang meningkatkan beban baca |
| Sentence Complexity | Kalimat panjang dan kompleks meningkatkan difficulty |
| Technical Jargon Density | Istilah teknis menurunkan beginner score |
| Methodology Complexity | Metode kompleks meningkatkan difficulty |
| Statistical Complexity | Model, formula, dan istilah statistik meningkatkan difficulty |
| Concept Prerequisite | Banyak konsep prasyarat meningkatkan difficulty |
| Domain Specificity | Topik yang sangat spesifik cenderung lebih sulit |
| Abstract Clarity | Abstract yang jelas meningkatkan beginner score |
| Metadata Completeness | Metadata lengkap meningkatkan keandalan classification |

## Quality Gate and Review

Paper tidak dipublikasikan hanya berdasarkan score. Sistem juga memeriksa kelengkapan metadata dan classification.

| Outcome | Paper Status |
| --- | --- |
| Metadata dan classification lengkap | `published` |
| Metadata ambigu, abstract terlalu pendek, classification tidak lengkap, atau confidence rendah | `needs_review` |
| Ditolak admin | `rejected` |
| Dinonaktifkan atau hasil merge duplicate | `inactive` |
| Belum selesai diproses | `pending` |

Admin dapat:

- memperbaiki metadata;
- menjalankan ulang classifier;
- memberikan manual classification;
- publish setelah seluruh persyaratan terpenuhi;
- reject atau deactivate paper;
- melihat classification audit trail.

---

# 7. Functional Requirements

## Guest and User Requirements

| Feature | User Story | Requirement |
| --- | --- | --- |
| Register | Sebagai guest, saya ingin membuat akun | Register menggunakan nama, email, dan password |
| Login | Sebagai user, saya ingin mengakses data pribadi | Better Auth session melalui same-origin web route |
| Paper Library | Sebagai pengguna, saya ingin mencari paper | Library hanya menampilkan paper `published` |
| Search | Sebagai pengguna, saya ingin mencari berdasarkan keyword | Search title dan metadata relevan |
| Filter | Sebagai pengguna, saya ingin memfilter paper | Filter category dan difficulty |
| Sort | Sebagai pengguna, saya ingin mengurutkan hasil | Sorting berdasarkan opsi yang tersedia |
| Paper Detail | Sebagai pengguna, saya ingin mengevaluasi paper sebelum membaca | Tampilkan metadata, abstract, classification, reason, warning, dan source |
| Start Reading | Sebagai user, saya ingin mulai membaca | Membuat atau memperbarui reading progress |
| Update Progress | Sebagai user, saya ingin menyimpan progress | Percentage tervalidasi dan session-owned |
| Complete Reading | Sebagai user, saya ingin menandai paper selesai | Status completed dan statistics diperbarui |
| Bookmark | Sebagai user, saya ingin menyimpan paper | Add/remove idempotent dan session-owned |
| Notes | Sebagai user, saya ingin membuat catatan | CRUD notes per paper dan user |
| Statistics | Sebagai user, saya ingin melihat aktivitas membaca | Data dihitung dari records milik session user |
| Logout | Sebagai user, saya ingin mengakhiri session | Cookie session dihapus dan protected access ditutup |

## Admin Requirements

| Feature | Requirement |
| --- | --- |
| Admin Access | Role diverifikasi dari database, bukan input client |
| Dashboard | Menampilkan overview paper, classification, ingestion, dan data quality |
| Paper Monitor | Menampilkan seluruh status paper untuk admin |
| OpenAlex Ingestion | Menjalankan ingestion berdasarkan category, query, dan limit |
| Classification | Menjalankan single-paper atau batch classification |
| Needs Review | Membuka paper `needs_review` dan melakukan remediation |
| Metadata Editor | Memperbaiki metadata dan daftar authors |
| Manual Classification | Menyimpan classification dengan provenance admin |
| Status Actions | Publish, reject, atau deactivate sesuai workflow |
| Data Quality | Melihat overview dan details masalah data |
| Duplicate Keep-Both | Menyimpan alasan auditable tanpa mengubah records |
| Duplicate Merge | Memilih canonical paper dan menggabungkan relations secara aman |
| Logs | Melihat hasil dan status ingestion |
| Error Handling | Menampilkan error yang sudah disanitasi dan request ID |

---

# 8. Data Model

Bagian ini menjelaskan entitas utama secara konseptual. Implementasi final menggunakan Prisma schema dan Better Auth models sebagai source of truth.

## Authentication Models

Better Auth mengelola model utama berikut:

- `user`;
- `session`;
- `account`;
- `verification`.

User memiliki database-backed role `user` atau `admin`.

## categories

| Field | Description |
| --- | --- |
| id | Primary key UUID |
| name | Nama category, unique secara logis |
| description | Deskripsi category |
| created_at / updated_at | Audit timestamps |

## papers

| Field | Description |
| --- | --- |
| id | Primary key UUID |
| title / abstract | Core paper metadata |
| authors | Structured author data |
| publication_year | Tahun publikasi |
| doi | Nullable, unique jika tersedia |
| category_id | Relasi ke category |
| language | Nullable |
| status | `pending`, `needs_review`, `published`, `rejected`, atau `inactive` |
| created_at / updated_at | Audit timestamps |

## paper_sources

| Field | Description |
| --- | --- |
| id | Primary key |
| paper_id | Relasi ke paper |
| provider | Source provider |
| external_id | Provider-specific identifier |
| source_url / pdf_url | Legal source links jika tersedia |
| raw_metadata | Sanitized provider metadata |
| fetched_at | Waktu pengambilan |

## paper_classifications

| Field | Description |
| --- | --- |
| paper_id | Relasi ke paper |
| difficulty_level | Difficulty enum |
| beginner_score | 0–100 |
| estimated_reading_time | Minutes |
| component scores | Abstract, sentence, jargon, methodology, statistical, prerequisite, clarity |
| classification_reason | Explanation |
| reading_warning | Difficulty warning |
| recommended_reader | Suitable reader profile |
| classification_version | Classifier version or manual provenance |
| created_at / updated_at | Audit timestamps |

## User Reading Models

### reading_progress

Session-owned progress per user and paper:

- status;
- progress percentage;
- started, completed, and last-read timestamps.

### bookmarks

Idempotent user-paper bookmark relation.

### reading_notes

User-owned notes per paper with optional section metadata.

## Operational Models

### ingestion_logs

Mencatat:

- provider;
- operation status;
- total fetched, saved, duplicate, invalid, dan rejected;
- sanitized error information;
- start and finish timestamps;
- log finalization state.

### classification audit

Mencatat classification version, status transition, reclassification, dan provenance.

### duplicate resolution records

Menyimpan fingerprint candidate group, resolution action, alasan, dan audit information.

---

# 9. Application Contract

## Browser-Facing Routes

Browser mengakses web origin untuk seluruh request utama:

```text
https://deepread-academic.vercel.app/
```

Auth dan tRPC menggunakan same-origin paths:

```text
/api/auth/*
/trpc/*
```

Next.js meneruskan request tersebut ke Express API melalui server-only upstream configuration.

## Authentication

Authentication menggunakan Better Auth, bukan custom JWT response.

Main browser flows:

| Flow | Path |
| --- | --- |
| Sign up | `/api/auth/sign-up/email` |
| Sign in | `/api/auth/sign-in/email` |
| Session | `/api/auth/get-session` |
| Sign out | `/api/auth/sign-out` |

Session disimpan menggunakan secure host-only cookie pada web origin production.

## tRPC Procedure Groups

| Router / Group | Responsibility |
| --- | --- |
| Public papers | Paper library, paper detail, filters, sorting, pagination |
| Categories | Category options and published-paper counts |
| Reading | Start, update, complete, and retrieve progress |
| Bookmarks | List, add, remove, and paper bookmark state |
| Notes | Create, list, update, group, and delete notes |
| Statistics | Session-owned reading statistics |
| Profile | Current-user profile and reading summary |
| Admin overview | Dashboard metrics |
| Admin ingestion | `admin.ingestion.runOpenAlex` and ingestion logs |
| Admin classification | Single-paper and batch classification |
| Admin papers | Paper monitoring, metadata remediation, and status transitions |
| Admin data quality | Overview, details, and duplicate resolution |

## Access Rules

- Guest procedures expose only `published` papers.
- Private procedures derive user identity from the authenticated session.
- Notes, bookmarks, and progress are scoped to the session owner.
- Admin procedures require a database-backed admin role.
- Client-side guards provide user experience only.
- Backend authorization remains the authoritative security boundary.

---

# 10. Technology Stack

| Layer | Technology | Current Use |
| --- | --- | --- |
| Frontend | Next.js App Router | Web UI, route handling, external rewrites |
| Backend | Express.js | Better Auth and tRPC API |
| Language | TypeScript | Frontend, backend, scripts, tests |
| Runtime / Package Manager | Bun | Development, scripts, workspace management |
| API Contract | tRPC | End-to-end typed application procedures |
| Authentication | Better Auth | Registration, session, cookie, roles |
| Database | Supabase PostgreSQL | Development and production relational data |
| ORM | Prisma | Schema, migrations, and database access |
| Paper Provider | OpenAlex | Metadata ingestion |
| Classification | Rule-based TypeScript service | Transparent difficulty classification |
| Monorepo | Turborepo | Workspace build and validation |
| Web Deployment | Vercel | `deepread-academic.vercel.app` |
| API Deployment | Vercel Functions | `deepread-academic-api.vercel.app` |
| Testing | Bun Test and Playwright | Unit, component, integration, and E2E |

Not used in Version 1:

- Redis;
- BullMQ;
- cron scheduler;
- background workers;
- PDF storage;
- external AI/LLM API.

---

# 11. System Architecture

```text
Browser
   ↓
Next.js Web — deepread-academic.vercel.app
   ├─ Pages and client UI
   ├─ Better Auth browser client
   ├─ tRPC browser client
   └─ Same-origin rewrites
         ├─ /api/auth/*
         └─ /trpc/*
              ↓
Express API — deepread-academic-api.vercel.app
   ├─ Better Auth
   ├─ tRPC routers
   ├─ request IDs and sanitized error handling
   ├─ health and readiness endpoints
   └─ OpenAlex ingestion and classification services
              ↓
Prisma
              ↓
Supabase PostgreSQL
```

External ingestion flow:

```text
Admin action
↓
Express API
↓
OpenAlex
↓
Normalization and deduplication
↓
Supabase PostgreSQL
↓
Classification and quality gate
↓
Published library or needs-review workflow
```

## Security Boundaries

| Boundary | Responsibility |
| --- | --- |
| AuthGuard and sidebar | Loading, redirect, and UX |
| Better Auth session | Authenticated identity |
| Private tRPC procedures | User access enforcement |
| Ownership queries | User-specific data isolation |
| Admin middleware | Database role verification |
| Prisma database access | Server-only database operations |
| Same-origin proxy | First-party cookies and consistent browser session |
| Exact origins | Prevent wildcard CORS and arbitrary origin trust |

---

# 12. Testing and Quality Assurance

## Test Layers

| Layer | Scope |
| --- | --- |
| Unit Tests | Validation, sanitization, merge policy, classification errors, and utilities |
| Component Tests | Paper filters, metadata editor, remediation, duplicate resolution, and auth guard |
| Access Integration | Public visibility, authentication, admin authorization, and ownership |
| Reading Integration | Progress, bookmarks, notes, and statistics |
| Pipeline Integration | Ingestion, classification, remediation, duplicate resolution, and rollback |
| E2E | Guest, user, and admin critical journeys |
| Production Smoke Test | Health, readiness, auth, profile, admin, logs, ingestion, and classification |

## Release Validation Result

| Validation | Result |
| --- | --- |
| Unit and component tests | Passed |
| Access-control integration tests | Passed |
| Reading-workflow integration tests | Passed |
| Pipeline/remediation integration tests | Passed |
| Playwright E2E | Passed |
| TypeScript typecheck | Passed |
| Web production build | Passed |
| API production build | Passed |
| Prisma generation and validation | Passed |
| Secret/client-bundle scan | Passed |
| Preview deployment rehearsal | Passed |
| Production smoke test | Passed |

## Reliability Controls

- test database confirmation guard;
- isolated local Supabase for integration and E2E;
- blocked external network during browser tests;
- bounded E2E startup, execution, cleanup, and shutdown;
- database-safe classification claims;
- idempotent ingestion retry behavior;
- duplicate merge transaction rollback;
- request IDs for production troubleshooting.

---

# 13. Deployment and Operations

## Production URLs

| Service | URL |
| --- | --- |
| Web | https://deepread-academic.vercel.app/ |
| API | https://deepread-academic-api.vercel.app/ |
| API Health | https://deepread-academic-api.vercel.app/health |
| API Readiness | https://deepread-academic-api.vercel.app/ready |

## Production Structure

| Project | Root Directory |
| --- | --- |
| deepread web project | `apps/web` |
| deepread API project | `apps/server` |

## Production Environment Contract

### Web

```text
API_UPSTREAM_URL=https://deepread-academic-api.vercel.app
NEXT_PUBLIC_SERVER_URL=https://deepread-academic.vercel.app
```

### API

```text
DATABASE_URL=<Supabase transaction pooler URL>
BETTER_AUTH_SECRET=<server-only secret>
BETTER_AUTH_URL=https://deepread-academic.vercel.app
CORS_ORIGIN=https://deepread-academic.vercel.app
NODE_ENV=production
```

`DIRECT_URL` is used only for guarded manual migrations and is not configured in Vercel runtime.

## Operational Guidance

| Operation | Initial Production Guidance |
| --- | --- |
| OpenAlex ingestion | Start with 5–25 papers |
| Classification | Start with 5–25 papers |
| Metadata remediation | Safe as an individual admin request |
| Duplicate merge | Review relation counts and use small candidate groups |
| Migration | Use guarded `prisma migrate deploy`, never `db push` |
| Health check | `/health` |
| Database readiness | `/ready` |
| Troubleshooting | Use request ID in API logs |

Larger batches must only be used after reviewing Vercel Function duration and database behavior.

---

# 14. Success Metrics

| Metric | Purpose |
| --- | --- |
| Search-to-read conversion | Mengukur apakah pengguna menemukan paper yang relevan |
| Paper opened | Mengukur ketertarikan awal |
| Reading started | Mengukur konversi dari discovery ke reading |
| Reading completed | Mengukur reading engagement |
| Bookmark count | Mengukur intention to read |
| Notes created | Mengukur active reading |
| Return rate | Mengukur kebiasaan penggunaan |
| Beginner-paper completion rate | Mengukur efektivitas classification |
| Needs-review resolution rate | Mengukur efektivitas admin remediation |
| Ingestion success rate | Mengukur stabilitas pipeline |

## Primary Product Metric

```text
Jumlah pengguna yang mulai membaca paper setelah melihat difficulty level, beginner score, dan classification explanation.
```

---

# 15. Development Roadmap

| Phase | Scope | Status |
| --- | --- | --- |
| Phase 1 | Project setup, database, authentication, and roles | Completed |
| Phase 2 | Paper schema, library, search, filters, sorting, and detail | Completed |
| Phase 3 | OpenAlex ingestion, normalization, deduplication, and logs | Completed |
| Phase 3.5 | Admin authentication and secure admin access | Completed |
| Phase 4 | Rule-based difficulty classification and admin tools | Completed |
| Phase 5 | Reading mode, progress, bookmarks, notes, profile, and UI | Completed |
| Phase 6 | Access-control and private-data security audit | Completed |
| Phase 7 | Reading statistics | Completed |
| Phase 8 | Admin monitoring and pipeline controls | Completed |
| Phase 9 | Classifier evaluation, calibration, and production integration | Completed |
| Phase 10 | Data quality, remediation, duplicate resolution, and cleanup | Completed |
| Phase 11 | Validation, integration, E2E, deployment, and documentation | Completed |

## Post-Release Priorities

1. refine login and register page visuals;
2. add email verification;
3. add password recovery;
4. evaluate production classifier accuracy using real usage data;
5. expand OpenAlex categories and paper coverage;
6. evaluate queue/worker architecture for larger batches;
7. evaluate additional metadata providers.

---

# 16. Final Product Decisions

| Question | Final Decision |
| --- | --- |
| Primary ingestion source | OpenAlex |
| Paper access | Redirect to source or legal PDF URL |
| Full-text processing | Not included in Version 1 |
| Indonesian-language paper support | Possible, but rule coverage remains limited |
| User difficulty feedback | Future scope |
| Admin classification override | Manual classification and reclassification supported |
| Reading time | Estimated reading time; progress is user-controlled |
| Ingestion scheduling | Manual admin trigger |
| API style | Better Auth routes and tRPC procedures |
| Background jobs | Not used in Version 1 |
| External AI/LLM | Not used |
| Admin promotion | Manual database role update |
| Production database | Separate Supabase project |
| Browser auth architecture | Same-origin Next.js proxy to Express API |

---

# 17. Known Limitations

1. Email verification is not available.
2. Forgot-password and reset-password flows are not available.
3. Administrator promotion is performed manually through the database.
4. Role changes may require session refresh or logout/login.
5. Large ingestion and classification batches are constrained by Vercel Function duration.
6. Difficulty classification remains rule-based and may not generalize equally across every academic field.
7. OpenAlex is the only implemented paper provider.
8. Full-text PDF parsing is not implemented.
9. Indonesian-language classification rules have limited coverage.
10. Login and register page visuals are scheduled for post-release refinement.

---

# 18. Release Notes — Version 1

**Release date:** 24 July 2026

Version 1 introduces the first production release of DeepRead with:

- public paper discovery;
- category and difficulty filtering;
- transparent difficulty classification;
- reading mode and progress;
- bookmarks, notes, profile, and statistics;
- OpenAlex ingestion;
- admin classification and remediation;
- data-quality monitoring;
- duplicate resolution;
- production deployment on Vercel and Supabase;
- unit, component, integration, E2E, and production rehearsal validation.

Deferred capabilities are documented under Future Scope and Known Limitations.
