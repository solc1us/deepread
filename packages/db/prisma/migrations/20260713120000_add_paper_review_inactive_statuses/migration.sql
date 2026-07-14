-- AlterEnum
ALTER TYPE "PaperStatus" ADD VALUE 'needs_review' BEFORE 'published';
ALTER TYPE "PaperStatus" ADD VALUE 'inactive' AFTER 'rejected';
