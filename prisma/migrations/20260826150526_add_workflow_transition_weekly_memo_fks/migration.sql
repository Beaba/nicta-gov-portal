-- AlterTable
ALTER TABLE "WorkflowTransition" ADD COLUMN     "memoId" TEXT,
ADD COLUMN     "weeklyReportId" TEXT;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_weeklyReportId_fkey" FOREIGN KEY ("weeklyReportId") REFERENCES "WeeklyManagerReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
