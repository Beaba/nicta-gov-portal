-- AlterTable
ALTER TABLE "ActionItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "DepartmentPerformance" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "kpiPercent" INTEGER NOT NULL,
    "kraPercent" INTEGER NOT NULL,
    "overdueActivities" INTEGER NOT NULL DEFAULT 0,
    "criticalRisks" INTEGER NOT NULL DEFAULT 0,
    "lastReportedAt" TIMESTAMP(3),
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DepartmentPerformance_departmentId_reportingPeriodId_key" ON "DepartmentPerformance"("departmentId", "reportingPeriodId");

-- AddForeignKey
ALTER TABLE "DepartmentPerformance" ADD CONSTRAINT "DepartmentPerformance_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentPerformance" ADD CONSTRAINT "DepartmentPerformance_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
