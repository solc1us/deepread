-- Rule-derived fields are nullable so manual admin classifications can be stored
-- without fabricating classifier scores or generated guidance.
ALTER TABLE "paper_classifications"
  ALTER COLUMN "beginner_score" DROP NOT NULL,
  ALTER COLUMN "estimated_reading_time" DROP NOT NULL,
  ALTER COLUMN "abstract_length_score" DROP NOT NULL,
  ALTER COLUMN "sentence_complexity_score" DROP NOT NULL,
  ALTER COLUMN "jargon_density_score" DROP NOT NULL,
  ALTER COLUMN "methodology_complexity_score" DROP NOT NULL,
  ALTER COLUMN "statistical_complexity_score" DROP NOT NULL,
  ALTER COLUMN "prerequisite_score" DROP NOT NULL,
  ALTER COLUMN "clarity_score" DROP NOT NULL,
  ALTER COLUMN "reading_warning" DROP NOT NULL,
  ALTER COLUMN "recommended_reader" DROP NOT NULL;

CREATE TABLE "admin_paper_audit_logs" (
  "id" UUID NOT NULL,
  "admin_user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "paper_id" UUID NOT NULL,
  "previous_values" JSONB,
  "new_values" JSONB,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "admin_paper_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_paper_audit_logs_admin_user_id_idx"
  ON "admin_paper_audit_logs"("admin_user_id");
CREATE INDEX "admin_paper_audit_logs_paper_id_idx"
  ON "admin_paper_audit_logs"("paper_id");
CREATE INDEX "admin_paper_audit_logs_created_at_idx"
  ON "admin_paper_audit_logs"("created_at");
