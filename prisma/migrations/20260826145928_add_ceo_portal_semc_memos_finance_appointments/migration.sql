-- AlterTable
ALTER TABLE "Deadline" ADD COLUMN     "requiredAnnexures" TEXT,
ADD COLUMN     "requiredDepartments" TEXT;

-- AlterTable
ALTER TABLE "Delegation" ADD COLUMN     "category" TEXT,
ADD COLUMN     "completionRequirement" TEXT NOT NULL DEFAULT 'EVIDENCE';

-- AlterTable
ALTER TABLE "Evidence" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "memoId" TEXT,
ADD COLUMN     "milestoneId" TEXT,
ADD COLUMN     "weeklyReportId" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "ceoAgendaStatus" TEXT,
ADD COLUMN     "ceoAgendaStatusAt" TIMESTAMP(3),
ADD COLUMN     "ceoAgendaStatusById" TEXT,
ADD COLUMN     "semcEscalationRecommended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "semcEscalationRecommendedAt" TIMESTAMP(3),
ADD COLUMN     "semcEscalationRecommendedById" TEXT;

-- CreateTable
CREATE TABLE "DelegationRecipient" (
    "id" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientRole" TEXT NOT NULL DEFAULT 'DIRECTOR',
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DelegationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "responsibleDirectorId" TEXT NOT NULL,
    "targetDescription" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "validationStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "directorComment" TEXT,
    "ceoComment" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyManagerReport" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "activityId" TEXT,
    "category" TEXT NOT NULL,
    "kpiKraContribution" TEXT,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "workCompleted" TEXT NOT NULL,
    "milestonesAchieved" TEXT,
    "plannedWork" TEXT,
    "delays" TEXT,
    "risks" TEXT,
    "decisionsRequired" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "lateJustification" TEXT,
    "directorReviewComment" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyManagerReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DirectorSummary" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "directorId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "keyAchievements" TEXT,
    "kpiKraProgressNote" TEXT,
    "milestonesNote" TEXT,
    "criticalActivities" TEXT,
    "delays" TEXT,
    "risks" TEXT,
    "decisionsRequired" TEXT,
    "nextPeriodPriorities" TEXT,
    "lastReportingDate" TIMESTAMP(3),
    "ceoValidationStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "ceoComment" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DirectorSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportAccessGrant" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityVersion" INTEGER,
    "grantedToUserId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memo" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "originatingDirectorId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "background" TEXT,
    "requestedDecision" TEXT NOT NULL,
    "recommendation" TEXT,
    "financialValue" DECIMAL(14,2),
    "budgetCode" TEXT,
    "costCentre" TEXT,
    "delegationAuthority" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "delegatedReviewerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialApprovalRule" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minAmount" DECIMAL(14,2) NOT NULL,
    "maxAmount" DECIMAL(14,2),
    "approvalStageSequence" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialApprovalRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "agenda" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Pacific/Port_Moresby',
    "location" TEXT,
    "teamsMeetingUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "meetingNotes" TEXT,
    "organiserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentInvitee" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" TEXT NOT NULL DEFAULT 'PENDING',
    "responseReason" TEXT,
    "alternateUserId" TEXT,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "AppointmentInvitee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppApprovalToken" (
    "id" TEXT NOT NULL,
    "memoId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "documentVersion" INTEGER NOT NULL,
    "phoneNumberSnapshot" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "command" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppApprovalToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DelegationRecipient_delegationId_userId_key" ON "DelegationRecipient"("delegationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_referenceNumber_key" ON "Milestone"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyManagerReport_referenceNumber_key" ON "WeeklyManagerReport"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyManagerReport_supersedesId_key" ON "WeeklyManagerReport"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "DirectorSummary_departmentId_reportingPeriodId_key" ON "DirectorSummary"("departmentId", "reportingPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "Memo_referenceNumber_key" ON "Memo"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentInvitee_appointmentId_userId_key" ON "AppointmentInvitee"("appointmentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppApprovalToken_token_key" ON "WhatsAppApprovalToken"("token");

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_weeklyReportId_fkey" FOREIGN KEY ("weeklyReportId") REFERENCES "WeeklyManagerReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationRecipient" ADD CONSTRAINT "DelegationRecipient_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "Delegation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationRecipient" ADD CONSTRAINT "DelegationRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_responsibleDirectorId_fkey" FOREIGN KEY ("responsibleDirectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyManagerReport" ADD CONSTRAINT "WeeklyManagerReport_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyManagerReport" ADD CONSTRAINT "WeeklyManagerReport_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyManagerReport" ADD CONSTRAINT "WeeklyManagerReport_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyManagerReport" ADD CONSTRAINT "WeeklyManagerReport_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyManagerReport" ADD CONSTRAINT "WeeklyManagerReport_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "WeeklyManagerReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorSummary" ADD CONSTRAINT "DirectorSummary_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorSummary" ADD CONSTRAINT "DirectorSummary_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DirectorSummary" ADD CONSTRAINT "DirectorSummary_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportAccessGrant" ADD CONSTRAINT "ReportAccessGrant_grantedToUserId_fkey" FOREIGN KEY ("grantedToUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_originatingDirectorId_fkey" FOREIGN KEY ("originatingDirectorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memo" ADD CONSTRAINT "Memo_delegatedReviewerId_fkey" FOREIGN KEY ("delegatedReviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organiserId_fkey" FOREIGN KEY ("organiserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentInvitee" ADD CONSTRAINT "AppointmentInvitee_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentInvitee" ADD CONSTRAINT "AppointmentInvitee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppApprovalToken" ADD CONSTRAINT "WhatsAppApprovalToken_memoId_fkey" FOREIGN KEY ("memoId") REFERENCES "Memo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
