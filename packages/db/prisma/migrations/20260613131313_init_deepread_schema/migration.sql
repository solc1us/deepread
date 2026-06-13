-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "PaperStatus" AS ENUM ('pending', 'published', 'rejected');

-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('beginner_friendly', 'moderate', 'difficult', 'expert');

-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('not_started', 'reading', 'completed');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('success', 'failed', 'partial');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "education_level" TEXT,
    "interests" JSONB,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "papers" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL,
    "authors" JSONB NOT NULL,
    "publication_year" INTEGER,
    "doi" TEXT,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "pdf_url" TEXT,
    "category_id" UUID NOT NULL,
    "keywords" JSONB,
    "language" TEXT,
    "status" "PaperStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_sources" (
    "id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "raw_metadata" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paper_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paper_classifications" (
    "id" UUID NOT NULL,
    "paper_id" UUID NOT NULL,
    "difficulty_level" "DifficultyLevel" NOT NULL,
    "beginner_score" INTEGER NOT NULL,
    "estimated_reading_time" INTEGER NOT NULL,
    "abstract_length_score" INTEGER NOT NULL,
    "sentence_complexity_score" INTEGER NOT NULL,
    "jargon_density_score" INTEGER NOT NULL,
    "methodology_complexity_score" INTEGER NOT NULL,
    "statistical_complexity_score" INTEGER NOT NULL,
    "prerequisite_score" INTEGER NOT NULL,
    "clarity_score" INTEGER NOT NULL,
    "classification_reason" TEXT NOT NULL,
    "reading_warning" TEXT NOT NULL,
    "recommended_reader" TEXT NOT NULL,
    "classification_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paper_classifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "paper_id" UUID NOT NULL,
    "status" "ReadingStatus" NOT NULL DEFAULT 'not_started',
    "progress_percentage" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "last_read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "paper_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_notes" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "paper_id" UUID NOT NULL,
    "note" TEXT NOT NULL,
    "section" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reading_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_logs" (
    "id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "IngestionStatus" NOT NULL,
    "total_fetched" INTEGER NOT NULL DEFAULT 0,
    "total_saved" INTEGER NOT NULL DEFAULT 0,
    "total_rejected" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingestion_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "papers_doi_key" ON "papers"("doi");

-- CreateIndex
CREATE INDEX "papers_category_id_idx" ON "papers"("category_id");

-- CreateIndex
CREATE INDEX "papers_status_idx" ON "papers"("status");

-- CreateIndex
CREATE INDEX "papers_publication_year_idx" ON "papers"("publication_year");

-- CreateIndex
CREATE INDEX "paper_sources_paper_id_idx" ON "paper_sources"("paper_id");

-- CreateIndex
CREATE INDEX "paper_sources_provider_idx" ON "paper_sources"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "paper_sources_provider_external_id_key" ON "paper_sources"("provider", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "paper_classifications_paper_id_key" ON "paper_classifications"("paper_id");

-- CreateIndex
CREATE INDEX "paper_classifications_difficulty_level_idx" ON "paper_classifications"("difficulty_level");

-- CreateIndex
CREATE INDEX "paper_classifications_beginner_score_idx" ON "paper_classifications"("beginner_score");

-- CreateIndex
CREATE INDEX "reading_progress_paper_id_idx" ON "reading_progress"("paper_id");

-- CreateIndex
CREATE INDEX "reading_progress_status_idx" ON "reading_progress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reading_progress_user_id_paper_id_key" ON "reading_progress"("user_id", "paper_id");

-- CreateIndex
CREATE INDEX "bookmarks_paper_id_idx" ON "bookmarks"("paper_id");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_user_id_paper_id_key" ON "bookmarks"("user_id", "paper_id");

-- CreateIndex
CREATE INDEX "reading_notes_user_id_paper_id_idx" ON "reading_notes"("user_id", "paper_id");

-- CreateIndex
CREATE INDEX "reading_notes_paper_id_idx" ON "reading_notes"("paper_id");

-- CreateIndex
CREATE INDEX "ingestion_logs_provider_idx" ON "ingestion_logs"("provider");

-- CreateIndex
CREATE INDEX "ingestion_logs_status_idx" ON "ingestion_logs"("status");

-- CreateIndex
CREATE INDEX "ingestion_logs_started_at_idx" ON "ingestion_logs"("started_at");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "papers" ADD CONSTRAINT "papers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_sources" ADD CONSTRAINT "paper_sources_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paper_classifications" ADD CONSTRAINT "paper_classifications_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_notes" ADD CONSTRAINT "reading_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_notes" ADD CONSTRAINT "reading_notes_paper_id_fkey" FOREIGN KEY ("paper_id") REFERENCES "papers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
