CREATE TYPE "DuplicateGroupResolutionType" AS ENUM ('keep_both', 'merge');

CREATE TABLE "duplicate_group_resolutions" (
  "id" UUID NOT NULL,
  "group_key" TEXT NOT NULL,
  "group_fingerprint" TEXT NOT NULL,
  "resolution" "DuplicateGroupResolutionType" NOT NULL,
  "canonical_paper_id" UUID,
  "paper_ids" JSONB NOT NULL,
  "duplicate_paper_ids" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "resolved_by_id" TEXT NOT NULL,
  "resolved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "duplicate_group_resolutions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "duplicate_group_resolutions_group_fingerprint_key"
  ON "duplicate_group_resolutions"("group_fingerprint");
CREATE INDEX "duplicate_group_resolutions_group_key_idx"
  ON "duplicate_group_resolutions"("group_key");
CREATE INDEX "duplicate_group_resolutions_resolution_idx"
  ON "duplicate_group_resolutions"("resolution");
CREATE INDEX "duplicate_group_resolutions_canonical_paper_id_idx"
  ON "duplicate_group_resolutions"("canonical_paper_id");
CREATE INDEX "duplicate_group_resolutions_resolved_by_id_idx"
  ON "duplicate_group_resolutions"("resolved_by_id");
CREATE INDEX "duplicate_group_resolutions_resolved_at_idx"
  ON "duplicate_group_resolutions"("resolved_at");

ALTER TABLE "duplicate_group_resolutions"
  ADD CONSTRAINT "duplicate_group_resolutions_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "user"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
