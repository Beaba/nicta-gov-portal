-- DropIndex
DROP INDEX "Submission_boardReferenceNumber_key";

-- AlterTable
ALTER TABLE "ActionItem" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "submissionId" TEXT;

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "boardReferenceNumber",
DROP COLUMN "vettedForBoard",
DROP COLUMN "vettedForBoardAt",
DROP COLUMN "vettedForBoardById",
ADD COLUMN     "endorsedForBoard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "endorsedForBoardAt" TIMESTAMP(3),
ADD COLUMN     "endorsedForBoardById" TEXT;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

