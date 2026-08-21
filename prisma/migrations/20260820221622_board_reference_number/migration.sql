-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "boardReferenceNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Submission_boardReferenceNumber_key" ON "Submission"("boardReferenceNumber");

