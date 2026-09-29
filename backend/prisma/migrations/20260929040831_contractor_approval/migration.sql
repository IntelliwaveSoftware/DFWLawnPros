-- AlterTable
ALTER TABLE "contractors" ADD COLUMN     "approved_at" TIMESTAMPTZ(3),
ADD COLUMN     "approved_by" TEXT;

-- Companies that joined before approvals existed keep their access.
UPDATE "contractors" SET "approved_at" = "created_at", "approved_by" = 'pre-approval signup' WHERE "approved_at" IS NULL;
