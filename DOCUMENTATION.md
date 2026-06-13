# PRD.md

# AI-Assisted Academic Reading Platform for Beginner-Friendly Paper Discovery

## 1. Overview

Platform ini adalah web application yang membantu mahasiswa menemukan, memilih, dan membaca paper atau jurnal open-access yang sesuai dengan tingkat kesiapan baca mereka. Produk ini dibuat untuk menyelesaikan masalah utama mahasiswa ketika ingin mulai membaca paper akademik: terlalu banyak pilihan, sulit menentukan paper yang cocok untuk pemula, dan cepat menyerah karena paper yang dipilih terlalu berat.

Platform ini tidak bertujuan menggantikan proses membaca dengan ringkasan instan. Fokus utama produk adalah membantu mahasiswa memilih paper yang lebih tepat, mulai membaca dengan lebih percaya diri, dan membangun kebiasaan membaca akademik secara bertahap.

Sistem akan mengumpulkan paper secara otomatis dari sumber open-access melalui API atau metadata provider resmi. Setelah paper dikumpulkan, sistem akan melakukan validasi metadata, pengecekan status open-access, deduplikasi, dan klasifikasi tingkat kesulitan secara otomatis menggunakan pendekatan rule-based atau heuristic-based classification.

Admin tetap disediakan, tetapi bukan untuk upload dan review paper satu per satu. Admin digunakan sebagai monitoring dashboard untuk melihat status pipeline, log ingestion, error, distribusi paper, dan konfigurasi klasifikasi.

## Product Positioning

Platform membaca akademik berbasis automated paper ingestion dan heuristic-based difficulty classification yang membantu mahasiswa menemukan paper open-access yang sesuai dengan tingkat kesiapan baca mereka.

## Core Product Statement

Platform ini membantu mahasiswa memilih paper yang tepat, mulai membaca dengan lebih percaya diri, dan membangun kebiasaan membaca akademik melalui pengalaman membaca yang sederhana, terarah, dan ramah untuk pemula.

## Final MVP Definition

MVP produk ini adalah web application yang memungkinkan mahasiswa menemukan paper open-access yang sudah diklasifikasikan berdasarkan tingkat kesulitan, membaca paper melalui reading mode sederhana, menyimpan progress membaca, melakukan bookmark, membuat catatan sederhana, dan melihat statistik membaca pribadi.

---

# 2. Vision and Goals

## Vision

Menjadi personal academic reading tool yang membantu mahasiswa membangun kebiasaan membaca paper akademik melalui pemilihan paper yang lebih terkurasi, klasifikasi tingkat kesulitan otomatis, dan pengalaman membaca yang sederhana serta ramah untuk pembaca pemula.

## Goals

| Goal                              | Description                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Membantu pemilihan paper          | Membantu mahasiswa menemukan paper open-access yang cocok untuk pembaca pemula |
| Mengurangi information overload   | Mengurangi kebingungan akibat terlalu banyaknya pilihan paper di internet      |
| Mengklasifikasikan difficulty     | Memberikan indikator tingkat kesulitan paper secara otomatis                   |
| Meningkatkan reading engagement   | Membantu user memulai, melanjutkan, dan menyelesaikan bacaan                   |
| Membentuk kebiasaan membaca       | Menyediakan progress dan statistik membaca agar user terbiasa membaca paper    |
| Mengotomatisasi pengumpulan paper | Mengurangi kebutuhan admin untuk upload paper satu per satu                    |

---

# 3. User, Pain Points, and Value Proposition

| Aspect            | Description                                                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Primary User      | Mahasiswa yang ingin mulai membaca paper akademik tetapi kesulitan memilih bacaan yang cocok                                                                                                           |
| Main Pain Point   | User bingung memilih paper karena terlalu banyak pilihan, abstract sulit dipahami, dan tidak tahu paper mana yang ramah untuk pemula                                                                   |
| User Need         | User membutuhkan platform yang membantu memilih paper berdasarkan bidang, tingkat kesulitan, dan kesesuaian untuk pembaca pemula                                                                       |
| Value Proposition | Platform membantu mahasiswa menemukan paper open-access yang lebih mudah dibaca melalui klasifikasi difficulty otomatis, lalu menyediakan reading mode dan statistik untuk membangun kebiasaan membaca |
| Expected Outcome  | User lebih mudah memulai membaca, lebih tahan membaca, dan semakin terbiasa membaca sumber akademik asli                                                                                               |

---

# 4. MVP Scope

## MVP Features

| Feature                              | Description                                                                                 | Priority    |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | ----------- |
| User Authentication                  | Register, login, logout, dan profil sederhana                                               | Must Have   |
| Paper Library                        | Menampilkan daftar paper yang sudah dikumpulkan dan diklasifikasikan                        | Must Have   |
| Search and Filter                    | Search berdasarkan keyword, filter berdasarkan bidang dan difficulty                        | Must Have   |
| Paper Detail                         | Menampilkan metadata paper, abstract, difficulty score, alasan klasifikasi, dan link sumber | Must Have   |
| Automated Paper Ingestion            | Mengambil metadata paper otomatis dari sumber open-access                                   | Must Have   |
| Open-Access Validation               | Memastikan paper memiliki status open-access atau link legal                                | Must Have   |
| Rule-Based Difficulty Classification | Mengklasifikasikan paper berdasarkan tingkat kesulitan dan beginner suitability score       | Must Have   |
| Reading Mode                         | Tampilan membaca yang bersih, fokus, dan minim distraksi                                    | Must Have   |
| Reading Progress                     | Menyimpan status not started, reading, dan completed                                        | Must Have   |
| Bookmark                             | Menyimpan paper untuk dibaca nanti                                                          | Must Have   |
| Reading Notes                        | User dapat membuat catatan sederhana pada paper                                             | Should Have |
| Reading Statistics                   | Menampilkan statistik membaca user                                                          | Must Have   |
| Admin Monitoring Dashboard           | Menampilkan pipeline status, log, error, distribusi paper, dan hasil klasifikasi            | Must Have   |

## Future Scope

| Feature                      | Description                                                  |
| ---------------------------- | ------------------------------------------------------------ |
| Personalized Recommendation  | Rekomendasi paper berdasarkan riwayat baca user              |
| Reading Queue                | User dapat membuat daftar bacaan pribadi                     |
| AI Guiding Questions         | Sistem membuat pertanyaan pemantik sebelum membaca           |
| Learning Path                | Urutan bacaan berdasarkan topik tertentu                     |
| User Feedback for Difficulty | User dapat memberi feedback apakah paper terlalu mudah/sulit |
| Citation Support             | Bantuan format sitasi                                        |
| Export Notes                 | Export catatan user                                          |
| Community Reading Group      | Grup diskusi paper                                           |

---

# 5. Automated Paper Ingestion

## Description

Automated paper ingestion adalah proses pengumpulan paper secara otomatis dari sumber open-access atau metadata provider resmi. Tujuannya adalah mengurangi kebutuhan admin untuk memasukkan paper satu per satu.

## Recommended Sources

| Source         | Function                                                                          |
| -------------- | --------------------------------------------------------------------------------- |
| OpenAlex       | Sumber utama metadata paper, author, abstract, topic, DOI, dan open-access status |
| Unpaywall      | Validasi status open-access dan pencarian link full text legal                    |
| Crossref       | Metadata enrichment berdasarkan DOI                                               |
| CORE           | Alternatif untuk metadata dan full text open-access                               |
| arXiv          | Sumber tambahan untuk computer science, mathematics, physics, dan preprint        |
| PubMed Central | Sumber tambahan untuk biomedical dan life sciences                                |
| DOAJ           | Sumber tambahan untuk jurnal open-access                                          |

## Ingestion Flow

```text
Scheduler
↓
Fetch paper metadata from source API
↓
Normalize metadata
↓
Check open-access status
↓
Deduplicate paper
↓
Run difficulty classification
↓
Store paper and classification result
↓
Expose paper to user library
```

## Minimum Paper Requirement

Paper hanya masuk ke library user jika memenuhi syarat berikut:

| Requirement              | Description                                        |
| ------------------------ | -------------------------------------------------- |
| Title exists             | Paper memiliki judul                               |
| Abstract exists          | Paper memiliki abstract agar bisa diklasifikasikan |
| Source exists            | Paper memiliki sumber yang valid                   |
| Open-access valid        | Paper dapat diakses secara legal                   |
| Category exists          | Paper memiliki bidang/topik                        |
| Classification completed | Paper sudah memiliki hasil klasifikasi difficulty  |
| Duplicate check passed   | Paper bukan duplikasi dari paper yang sudah ada    |

---

# 6. Difficulty Classification

## Description

Difficulty classification digunakan untuk menilai apakah sebuah paper cocok dibaca oleh mahasiswa yang baru mulai membaca paper akademik. Untuk MVP, sistem menggunakan rule-based atau heuristic-based classification agar lebih transparan, mudah dijelaskan, dan tidak membutuhkan dataset training.

## Classification Input

| Input                | Description                         |
| -------------------- | ----------------------------------- |
| Title                | Judul paper                         |
| Abstract             | Abstract paper                      |
| Keywords             | Keyword paper jika tersedia         |
| Field / Category     | Bidang atau kategori paper          |
| Publication Metadata | Tahun, source, DOI, dan author      |
| Full Text            | Opsional jika tersedia secara legal |

## Classification Output

| Output                 | Description                                        |
| ---------------------- | -------------------------------------------------- |
| Difficulty Level       | beginner_friendly, moderate, difficult, expert     |
| Beginner Score         | Skor 0–100 untuk menunjukkan kecocokan bagi pemula |
| Estimated Reading Time | Estimasi waktu baca dalam menit                    |
| Classification Reason  | Alasan kenapa paper dianggap mudah/sulit           |
| Reading Warning        | Catatan bagian yang mungkin sulit                  |
| Recommended Reader     | Profil pembaca yang cocok                          |

## Difficulty Level

| Level             | Score Range | Description                                             |
| ----------------- | ----------: | ------------------------------------------------------- |
| Beginner Friendly |      80–100 | Cocok untuk mahasiswa yang baru mulai membaca paper     |
| Moderate          |       60–79 | Masih cukup cocok, tetapi membutuhkan pengetahuan dasar |
| Difficult         |       40–59 | Membutuhkan pemahaman konsep atau metode tertentu       |
| Expert            |        0–39 | Sangat teknis dan kurang cocok untuk pemula             |

## Classification Indicators

| Indicator                | Description                                                    |
| ------------------------ | -------------------------------------------------------------- |
| Abstract Length          | Abstract terlalu panjang dapat meningkatkan beban baca         |
| Sentence Complexity      | Kalimat panjang dan kompleks membuat paper lebih sulit         |
| Technical Jargon Density | Banyak istilah teknis menurunkan beginner score                |
| Methodology Complexity   | Metode penelitian yang rumit membuat paper lebih sulit         |
| Statistical Complexity   | Banyak istilah statistik, rumus, model, atau analisis kompleks |
| Concept Prerequisite     | Banyaknya konsep prasyarat yang perlu dipahami                 |
| Domain Specificity       | Paper yang terlalu spesifik cenderung lebih sulit untuk pemula |
| Abstract Clarity         | Abstract yang jelas meningkatkan beginner score                |
| Metadata Completeness    | Metadata yang lengkap meningkatkan kualitas klasifikasi        |

## Example Scoring Logic

```text
beginner_score = 100 - total_penalty
```

| Penalty Component              | Range |
| ------------------------------ | ----: |
| Abstract length penalty        |  0–15 |
| Sentence complexity penalty    |  0–15 |
| Jargon density penalty         |  0–20 |
| Method complexity penalty      |  0–20 |
| Statistical complexity penalty |  0–15 |
| Domain specificity penalty     |  0–10 |
| Missing metadata penalty       |   0–5 |

---

# 7. MVP Requirements

| Feature             | User Story                                                                         | Requirement                                                                                |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Register            | Sebagai user, saya ingin membuat akun agar progress membaca saya tersimpan         | User dapat register dengan nama, email, dan password                                       |
| Login               | Sebagai user, saya ingin login agar dapat mengakses data pribadi                   | User dapat login menggunakan email dan password                                            |
| Interest Selection  | Sebagai user, saya ingin memilih bidang minat agar paper yang tampil lebih relevan | User dapat memilih satu atau beberapa bidang minat                                         |
| Paper Library       | Sebagai user, saya ingin melihat daftar paper agar bisa memilih bacaan             | Sistem menampilkan daftar paper yang sudah published dan terklasifikasi                    |
| Search Paper        | Sebagai user, saya ingin mencari paper berdasarkan keyword                         | Sistem menyediakan search berdasarkan title, abstract, dan keyword                         |
| Filter Paper        | Sebagai user, saya ingin memfilter paper berdasarkan bidang dan difficulty         | Sistem menyediakan filter category dan difficulty level                                    |
| Sort Paper          | Sebagai user, saya ingin mengurutkan paper berdasarkan beginner score              | Sistem menyediakan sorting berdasarkan beginner score                                      |
| Paper Detail        | Sebagai user, saya ingin melihat detail paper sebelum membaca                      | Sistem menampilkan metadata, abstract, difficulty, score, reason, warning, dan source link |
| Start Reading       | Sebagai user, saya ingin mulai membaca paper                                       | Sistem mengubah status paper menjadi reading                                               |
| Reading Mode        | Sebagai user, saya ingin membaca dengan tampilan fokus                             | Sistem menyediakan reading view minim distraksi                                            |
| Save Progress       | Sebagai user, saya ingin progress membaca saya tersimpan                           | Sistem menyimpan status dan progress percentage                                            |
| Mark Completed      | Sebagai user, saya ingin menandai paper selesai dibaca                             | Sistem mengubah status menjadi completed dan update statistik                              |
| Bookmark            | Sebagai user, saya ingin menyimpan paper untuk dibaca nanti                        | Sistem menyediakan add/remove bookmark                                                     |
| Reading Notes       | Sebagai user, saya ingin mencatat poin penting saat membaca                        | Sistem menyediakan catatan sederhana per paper                                             |
| Statistics          | Sebagai user, saya ingin melihat perkembangan membaca saya                         | Sistem menampilkan total paper read, reading time, bookmark, dan difficulty distribution   |
| Automated Ingestion | Sebagai sistem, saya ingin mengambil paper otomatis                                | Sistem mengambil paper dari source API berdasarkan schedule                                |
| OA Validation       | Sebagai sistem, saya ingin memastikan paper legal diakses                          | Sistem memvalidasi open-access status dan source URL                                       |
| Classification      | Sebagai sistem, saya ingin menilai difficulty paper                                | Sistem menjalankan rule-based classifier otomatis                                          |
| Admin Dashboard     | Sebagai admin, saya ingin memantau pipeline                                        | Admin dapat melihat log, error, total paper, classification status, dan rerun pipeline     |

---

# 8. Data Schema

## users

| Field           | Type      | Notes              |
| --------------- | --------- | ------------------ |
| id              | UUID      | Primary key        |
| name            | String    | Nama user          |
| email           | String    | Unique             |
| password_hash   | String    | Encrypted password |
| education_level | String    | Optional           |
| interests       | JSON      | List bidang minat  |
| role            | Enum      | user, admin        |
| created_at      | Timestamp |                    |
| updated_at      | Timestamp |                    |

## categories

| Field       | Type      | Notes       |
| ----------- | --------- | ----------- |
| id          | UUID      | Primary key |
| name        | String    | Nama bidang |
| description | Text      | Optional    |
| created_at  | Timestamp |             |
| updated_at  | Timestamp |             |

## papers

| Field            | Type      | Notes                         |
| ---------------- | --------- | ----------------------------- |
| id               | UUID      | Primary key                   |
| title            | Text      | Judul paper                   |
| abstract         | Text      | Abstract paper                |
| authors          | JSON      | List author                   |
| publication_year | Integer   | Tahun publikasi               |
| doi              | String    | Nullable, unique if available |
| source_name      | String    | Nama sumber                   |
| source_url       | Text      | Link sumber                   |
| pdf_url          | Text      | Nullable                      |
| category_id      | UUID      | Foreign key                   |
| keywords         | JSON      | Nullable                      |
| language         | String    | Nullable                      |
| status           | Enum      | pending, published, rejected  |
| created_at       | Timestamp |                               |
| updated_at       | Timestamp |                               |

## paper_sources

| Field        | Type      | Notes                                     |
| ------------ | --------- | ----------------------------------------- |
| id           | UUID      | Primary key                               |
| paper_id     | UUID      | Foreign key                               |
| provider     | String    | openalex, unpaywall, crossref, core, etc. |
| external_id  | String    | ID dari provider                          |
| raw_metadata | JSON      | Data mentah dari provider                 |
| fetched_at   | Timestamp | Waktu pengambilan                         |

## paper_classifications

| Field                        | Type      | Notes                                          |
| ---------------------------- | --------- | ---------------------------------------------- |
| id                           | UUID      | Primary key                                    |
| paper_id                     | UUID      | Foreign key                                    |
| difficulty_level             | Enum      | beginner_friendly, moderate, difficult, expert |
| beginner_score               | Integer   | 0–100                                          |
| estimated_reading_time       | Integer   | In minutes                                     |
| abstract_length_score        | Integer   | 0–100                                          |
| sentence_complexity_score    | Integer   | 0–100                                          |
| jargon_density_score         | Integer   | 0–100                                          |
| methodology_complexity_score | Integer   | 0–100                                          |
| statistical_complexity_score | Integer   | 0–100                                          |
| prerequisite_score           | Integer   | 0–100                                          |
| clarity_score                | Integer   | 0–100                                          |
| classification_reason        | Text      | Alasan klasifikasi                             |
| reading_warning              | Text      | Catatan kesulitan                              |
| recommended_reader           | Text      | Profil pembaca                                 |
| classification_version       | String    | Versi rule classifier                          |
| created_at                   | Timestamp |                                                |
| updated_at                   | Timestamp |                                                |

## reading_progress

| Field               | Type      | Notes                           |
| ------------------- | --------- | ------------------------------- |
| id                  | UUID      | Primary key                     |
| user_id             | UUID      | Foreign key                     |
| paper_id            | UUID      | Foreign key                     |
| status              | Enum      | not_started, reading, completed |
| progress_percentage | Integer   | 0–100                           |
| started_at          | Timestamp | Nullable                        |
| completed_at        | Timestamp | Nullable                        |
| last_read_at        | Timestamp | Nullable                        |
| created_at          | Timestamp |                                 |
| updated_at          | Timestamp |                                 |

## bookmarks

| Field      | Type      | Notes       |
| ---------- | --------- | ----------- |
| id         | UUID      | Primary key |
| user_id    | UUID      | Foreign key |
| paper_id   | UUID      | Foreign key |
| created_at | Timestamp |             |

## reading_notes

| Field      | Type      | Notes       |
| ---------- | --------- | ----------- |
| id         | UUID      | Primary key |
| user_id    | UUID      | Foreign key |
| paper_id   | UUID      | Foreign key |
| note       | Text      | Isi catatan |
| section    | String    | Nullable    |
| created_at | Timestamp |             |
| updated_at | Timestamp |             |

## ingestion_logs

| Field          | Type      | Notes                    |
| -------------- | --------- | ------------------------ |
| id             | UUID      | Primary key              |
| provider       | String    | Source provider          |
| status         | Enum      | success, failed, partial |
| total_fetched  | Integer   | Jumlah data ditarik      |
| total_saved    | Integer   | Jumlah paper tersimpan   |
| total_rejected | Integer   | Jumlah paper ditolak     |
| error_message  | Text      | Nullable                 |
| started_at     | Timestamp |                          |
| finished_at    | Timestamp |                          |

---

# 9. API Contract

Base URL:

```text
/api
```

## 9.1 Auth API

| Method | Endpoint       | Description      |
| ------ | -------------- | ---------------- |
| POST   | /auth/register | Register user    |
| POST   | /auth/login    | Login user       |
| POST   | /auth/logout   | Logout user      |
| GET    | /auth/me       | Get current user |

### POST /auth/register

Request:

```json
{
	"name": "User Name",
	"email": "user@mail.com",
	"password": "password123",
	"education_level": "undergraduate",
	"interests": ["technology", "education"]
}
```

Response:

```json
{
	"success": true,
	"data": {
		"user": {
			"id": "uuid",
			"name": "User Name",
			"email": "user@mail.com",
			"role": "user"
		},
		"token": "jwt_token"
	}
}
```

---

## 9.2 Paper API

| Method | Endpoint             | Description             |
| ------ | -------------------- | ----------------------- |
| GET    | /papers              | Get paper library       |
| GET    | /papers/:id          | Get paper detail        |
| GET    | /papers/:id/reading  | Open reading mode       |
| POST   | /papers/:id/start    | Start reading paper     |
| PATCH  | /papers/:id/progress | Update reading progress |
| POST   | /papers/:id/complete | Mark paper as completed |

### GET /papers

Query Params:

| Param       | Type   | Description                                    |
| ----------- | ------ | ---------------------------------------------- |
| q           | String | Search keyword                                 |
| category_id | UUID   | Filter by category                             |
| difficulty  | String | beginner_friendly, moderate, difficult, expert |
| sort        | String | beginner_score, newest, title                  |
| page        | Number | Page number                                    |
| limit       | Number | Items per page                                 |

Response:

```json
{
	"success": true,
	"data": {
		"papers": [
			{
				"id": "uuid",
				"title": "Paper Title",
				"authors": ["Author One", "Author Two"],
				"publication_year": 2024,
				"category": {
					"id": "uuid",
					"name": "Education"
				},
				"difficulty_level": "beginner_friendly",
				"beginner_score": 86,
				"estimated_reading_time": 18,
				"status": "not_started",
				"is_bookmarked": false
			}
		],
		"pagination": {
			"page": 1,
			"limit": 10,
			"total": 100,
			"total_pages": 10
		}
	}
}
```

### GET /papers/:id

Response:

```json
{
	"success": true,
	"data": {
		"id": "uuid",
		"title": "Paper Title",
		"abstract": "Paper abstract...",
		"authors": ["Author One"],
		"publication_year": 2024,
		"doi": "10.xxxx/xxxxx",
		"source_name": "OpenAlex",
		"source_url": "https://source-url.com",
		"pdf_url": "https://pdf-url.com",
		"keywords": ["keyword 1", "keyword 2"],
		"category": {
			"id": "uuid",
			"name": "Education"
		},
		"classification": {
			"difficulty_level": "beginner_friendly",
			"beginner_score": 86,
			"estimated_reading_time": 18,
			"classification_reason": "Paper has clear abstract and low technical jargon density.",
			"reading_warning": "Reader may need basic understanding of survey method.",
			"recommended_reader": "Beginner undergraduate students."
		},
		"user_progress": {
			"status": "not_started",
			"progress_percentage": 0
		},
		"is_bookmarked": false
	}
}
```

### PATCH /papers/:id/progress

Request:

```json
{
	"progress_percentage": 60
}
```

Response:

```json
{
	"success": true,
	"message": "Reading progress updated"
}
```

---

## 9.3 Bookmark API

| Method | Endpoint             | Description        |
| ------ | -------------------- | ------------------ |
| GET    | /bookmarks           | Get user bookmarks |
| POST   | /bookmarks/:paper_id | Add bookmark       |
| DELETE | /bookmarks/:paper_id | Remove bookmark    |

### GET /bookmarks

Response:

```json
{
	"success": true,
	"data": {
		"bookmarks": [
			{
				"id": "uuid",
				"paper": {
					"id": "uuid",
					"title": "Paper Title",
					"difficulty_level": "moderate",
					"beginner_score": 72
				},
				"created_at": "2026-06-13T10:00:00Z"
			}
		]
	}
}
```

---

## 9.4 Reading Notes API

| Method | Endpoint                | Description         |
| ------ | ----------------------- | ------------------- |
| GET    | /papers/:paper_id/notes | Get notes for paper |
| POST   | /papers/:paper_id/notes | Create note         |
| PATCH  | /notes/:id              | Update note         |
| DELETE | /notes/:id              | Delete note         |

### POST /papers/:paper_id/notes

Request:

```json
{
	"note": "Important point from this paper.",
	"section": "Abstract"
}
```

Response:

```json
{
	"success": true,
	"data": {
		"id": "uuid",
		"note": "Important point from this paper.",
		"section": "Abstract",
		"created_at": "2026-06-13T10:00:00Z"
	}
}
```

---

## 9.5 Statistics API

| Method | Endpoint       | Description                 |
| ------ | -------------- | --------------------------- |
| GET    | /statistics/me | Get user reading statistics |

### GET /statistics/me

Response:

```json
{
	"success": true,
	"data": {
		"total_completed": 12,
		"total_reading": 3,
		"total_bookmarked": 8,
		"total_reading_time": 240,
		"most_read_category": "Education",
		"difficulty_distribution": {
			"beginner_friendly": 7,
			"moderate": 4,
			"difficult": 1,
			"expert": 0
		}
	}
}
```

---

## 9.6 Admin API

| Method | Endpoint                              | Description                |
| ------ | ------------------------------------- | -------------------------- |
| GET    | /admin/dashboard                      | Get admin overview         |
| GET    | /admin/papers                         | Get all papers             |
| PATCH  | /admin/papers/:id/status              | Update paper status        |
| GET    | /admin/ingestion/logs                 | Get ingestion logs         |
| POST   | /admin/ingestion/run                  | Run ingestion manually     |
| POST   | /admin/classification/:paper_id/rerun | Rerun paper classification |
| GET    | /admin/classification/config          | Get classifier config      |
| PATCH  | /admin/classification/config          | Update classifier config   |

### GET /admin/dashboard

Response:

```json
{
	"success": true,
	"data": {
		"total_papers": 1200,
		"published_papers": 980,
		"rejected_papers": 220,
		"last_ingestion_status": "success",
		"last_ingestion_at": "2026-06-13T10:00:00Z",
		"difficulty_distribution": {
			"beginner_friendly": 300,
			"moderate": 420,
			"difficult": 210,
			"expert": 50
		}
	}
}
```

### POST /admin/ingestion/run

Request:

```json
{
	"provider": "openalex",
	"category_id": "uuid",
	"limit": 100
}
```

Response:

```json
{
	"success": true,
	"message": "Ingestion job started"
}
```

---

# 10. Tech Stack

## Recommended Stack

| Layer             | Technology                     | Reason                                                                 |
| ----------------- | ------------------------------ | ---------------------------------------------------------------------- |
| Frontend          | Next.js                        | Cocok untuk webapp modern, routing, SSR/CSR, dashboard, dan reading UI |
| Backend API       | Express.js                     | Fleksibel untuk API, ingestion trigger, worker, dan service separation |
| Language          | TypeScript                     | Type safety untuk frontend dan backend                                 |
| Database          | PostgreSQL                     | Cocok untuk relational data dan query kompleks                         |
| ORM               | Prisma                         | Schema jelas, migration mudah, cocok untuk TypeScript                  |
| Queue             | BullMQ                         | Untuk ingestion job dan classification job                             |
| Queue Storage     | Redis                          | Dibutuhkan oleh BullMQ                                                 |
| Scheduler         | Cron job / node-cron           | Menjalankan ingestion berkala                                          |
| Auth              | JWT / Session-based auth       | Untuk user dan admin authentication                                    |
| File/PDF Handling | External source URL first      | MVP tidak perlu menyimpan PDF secara lokal                             |
| Classification    | Rule-based TypeScript service  | Transparan, ringan, dan tidak perlu dataset training                   |
| Deployment        | Vercel + Railway/Render/Fly.io | Vercel untuk frontend, backend/worker/database di platform server      |

## Architecture Recommendation

Untuk MVP ini, stack yang paling rapi adalah:

```text
Next.js Frontend
↓
Express.js Backend API
↓
PostgreSQL Database
↓
Redis + BullMQ Worker
↓
OpenAlex / Unpaywall / Crossref API
```

---

# 11. System Architecture

```text
External Paper APIs
(OpenAlex, Unpaywall, Crossref)
        ↓
Ingestion Worker
        ↓
Metadata Normalization
        ↓
Open-Access Validation
        ↓
Deduplication
        ↓
Difficulty Classifier
        ↓
PostgreSQL Database
        ↓
Express API
        ↓
Next.js Web App
```

## Main Services

| Service               | Responsibility                                                         |
| --------------------- | ---------------------------------------------------------------------- |
| Web App               | User interface, reading mode, dashboard                                |
| Backend API           | Auth, paper API, bookmark, progress, statistics, admin API             |
| Ingestion Worker      | Mengambil paper dari source API                                        |
| Classification Worker | Menjalankan rule-based difficulty classifier                           |
| Database              | Menyimpan user, paper, classification, progress, bookmark, notes, logs |
| Queue                 | Menjalankan job ingestion dan classification secara asynchronous       |

---

# 12. Success Metrics

| Metric                         | Purpose                                              |
| ------------------------------ | ---------------------------------------------------- |
| Search-to-read conversion      | Mengukur apakah platform membantu user memilih paper |
| Paper opened                   | Mengukur ketertarikan awal                           |
| Reading started                | Mengukur user yang benar-benar mulai membaca         |
| Reading completed              | Mengukur apakah user bertahan sampai selesai         |
| Bookmark count                 | Mengukur minat user terhadap paper                   |
| Notes created                  | Mengukur active reading                              |
| Average reading duration       | Mengukur ketahanan membaca                           |
| Return rate                    | Mengukur apakah user kembali membaca                 |
| Beginner paper completion rate | Mengukur efektivitas beginner classification         |

## Main MVP Metric

```text
Jumlah user yang mulai membaca paper setelah melihat difficulty level dan beginner suitability score.
```

---

# 13. MVP Roadmap

| Phase   | Scope                                                        |
| ------- | ------------------------------------------------------------ |
| Phase 1 | Setup project, database, auth, user/admin role               |
| Phase 2 | Paper schema, paper library, search, filter, paper detail    |
| Phase 3 | Automated ingestion from OpenAlex and open-access validation |
| Phase 4 | Rule-based difficulty classifier                             |
| Phase 5 | Reading mode, progress, bookmark, notes                      |
| Phase 6 | Reading statistics                                           |
| Phase 7 | Admin monitoring dashboard                                   |
| Phase 8 | Testing, data cleanup, deployment                            |

---

# 14. Open Questions

| Question                                                  | Recommendation                                          |
| --------------------------------------------------------- | ------------------------------------------------------- |
| Sumber utama ingestion pertama apa?                       | OpenAlex + Unpaywall                                    |
| Apakah PDF ditampilkan langsung atau diarahkan ke source? | MVP: arahkan ke source atau gunakan legal PDF URL       |
| Apakah full text perlu diproses?                          | MVP: cukup title, abstract, keywords                    |
| Apakah paper Bahasa Indonesia didukung?                   | Bisa, tetapi classifier perlu rule tambahan             |
| Apakah user bisa memberi feedback difficulty?             | Masuk future scope                                      |
| Apakah admin boleh override classification?               | MVP: cukup rerun/config, bukan review manual            |
| Apakah reading time dihitung manual atau otomatis?        | MVP: estimated reading time + optional session tracking |
