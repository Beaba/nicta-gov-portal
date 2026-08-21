-- CreateEnum
CREATE TYPE "WorkplanApprovalStatus" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "KanbanStage" AS ENUM ('NOT_STARTED', 'PLANNED', 'IN_PROGRESS', 'AT_RISK', 'BLOCKED', 'PENDING_REVIEW', 'COMPLETED', 'DEFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED_MOCK');

-- CreateEnum
CREATE TYPE "EvidenceRole" AS ENUM ('MAIN_PAPER', 'ANNEXURE', 'GENERATED_DRAFT', 'AI_REVIEW_REPORT', 'HUMAN_REVIEW_RECORD', 'OTHER');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('SMC', 'BOARD');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'AGENDA_PREPARED', 'PACK_PREPARED', 'HELD', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubmissionCategory" AS ENUM ('SMC', 'BOARD');

-- CreateEnum
CREATE TYPE "ConfidentialityLevel" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'DONE', 'OVERDUE');

-- CreateEnum
CREATE TYPE "AIReviewOverallResult" AS ENUM ('PASS', 'PASS_WITH_WARNINGS', 'FAIL');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrategicObjective" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "financialYear" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "StrategicObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingPeriod" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ReportingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "SubmissionCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresRecommendation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaperType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "paperType" TEXT,
    "filePath" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedById" TEXT,
    "supersedesId" TEXT,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "entraObjectId" TEXT,
    "employeeId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "jobTitle" TEXT,
    "departmentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDemoUser" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workplan" (
    "id" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "strategicObjectiveId" TEXT,
    "corporatePlanReference" TEXT,
    "directorId" TEXT,
    "managerId" TEXT,
    "reportingPeriod" TEXT NOT NULL,
    "approvalStatus" "WorkplanApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Workplan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "workplanId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "strategicObjectiveId" TEXT,
    "expectedOutput" TEXT,
    "performanceIndicator" TEXT,
    "target" TEXT,
    "baseline" TEXT,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "priority" "ActivityPriority" NOT NULL DEFAULT 'MEDIUM',
    "responsibleOfficerId" TEXT,
    "supportingOfficers" TEXT,
    "percentComplete" INTEGER NOT NULL DEFAULT 0,
    "status" "KanbanStage" NOT NULL DEFAULT 'NOT_STARTED',
    "budgetAllocation" DECIMAL(14,2),
    "actualExpenditure" DECIMAL(14,2),
    "dependencies" TEXT,
    "risksIssues" TEXT,
    "mitigation" TEXT,
    "latestAchievement" TEXT,
    "nextAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityUpdate" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "progressPercent" INTEGER NOT NULL,
    "workCompleted" TEXT NOT NULL,
    "keyAchievements" TEXT,
    "deliverablesProduced" TEXT,
    "challenges" TEXT,
    "risks" TEXT,
    "mitigation" TEXT,
    "nextPeriodActions" TEXT,
    "supportRequired" TEXT,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "directorReviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "directorReviewComment" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,

    CONSTRAINT "ActivityUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activityId" TEXT,
    "activityUpdateId" TEXT,
    "submissionId" TEXT,
    "role" "EvidenceRole" NOT NULL DEFAULT 'OTHER',
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagementReport" (
    "id" TEXT NOT NULL,
    "workplanId" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedById" TEXT NOT NULL,
    "docxStorageKey" TEXT,
    "pdfStorageKey" TEXT,
    "aiExecutiveSummary" TEXT,
    "aiGenerationRecordId" TEXT,

    CONSTRAINT "ManagementReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "meetingType" "MeetingType" NOT NULL,
    "title" TEXT NOT NULL,
    "meetingNumber" TEXT NOT NULL,
    "meetingDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Pacific/Port_Moresby',
    "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "submissionOpenAt" TIMESTAMP(3) NOT NULL,
    "normalCloseAt" TIMESTAMP(3) NOT NULL,
    "lateCloseAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Pacific/Port_Moresby',
    "permittedPaperTypes" TEXT NOT NULL,
    "requiredReviewers" TEXT,
    "reminderScheduleNote" TEXT,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SequenceCounter" (
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SequenceCounter_pkey" PRIMARY KEY ("scope")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "submissionCategory" "SubmissionCategory" NOT NULL,
    "paperType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "sponsoringDirectorId" TEXT,
    "responsibleManagerId" TEXT,
    "meetingId" TEXT,
    "confidentiality" "ConfidentialityLevel" NOT NULL DEFAULT 'INTERNAL',
    "purpose" TEXT,
    "executiveSummary" TEXT,
    "recommendation" TEXT,
    "proposedDecision" TEXT,
    "financialImplications" TEXT,
    "legalImplications" TEXT,
    "riskImplications" TEXT,
    "technologyImplications" TEXT,
    "stakeholderImplications" TEXT,
    "previousReferences" TEXT,
    "proposedResolution" TEXT,
    "workflowStatus" TEXT NOT NULL,
    "isLate" BOOLEAN NOT NULL DEFAULT false,
    "lateJustification" TEXT,
    "lateCannotWaitReason" TEXT,
    "lateOperationalImpact" TEXT,
    "lateUrgency" TEXT,
    "lateExceptionApproverId" TEXT,
    "lateExceptionApprovedAt" TIMESTAMP(3),
    "sourceWorkplanId" TEXT,
    "sourceManagementReportId" TEXT,
    "smcSourceSubmissionId" TEXT,
    "mainDocumentStorageKey" TEXT,
    "mainDocumentFileName" TEXT,
    "generatedDraftStorageKey" TEXT,
    "templateId" TEXT,
    "routingFolderKey" TEXT,
    "routedAt" TIMESTAMP(3),
    "vettedForBoard" BOOLEAN NOT NULL DEFAULT false,
    "vettedForBoardAt" TIMESTAMP(3),
    "vettedForBoardById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionVersion" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "SubmissionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionAnnexure" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "carriedFromSubmissionId" TEXT,

    CONSTRAINT "SubmissionAnnexure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionReview" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "reviewerRole" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTransition" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "activityId" TEXT,
    "submissionId" TEXT,
    "fromState" TEXT NOT NULL,
    "toState" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment" TEXT,

    CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "decisionDate" TIMESTAMP(3) NOT NULL,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resolution" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT NOT NULL,
    "resolutionNumber" TEXT NOT NULL,
    "resolutionText" TEXT NOT NULL,
    "adoptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActionItem" (
    "id" TEXT NOT NULL,
    "decisionId" TEXT,
    "description" TEXT NOT NULL,
    "ownerId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "previousState" TEXT,
    "newState" TEXT,
    "correlationRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIReviewResult" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "templateId" TEXT,
    "overallResult" "AIReviewOverallResult" NOT NULL,
    "missingSections" TEXT NOT NULL,
    "warnings" TEXT NOT NULL,
    "suggestedCorrections" TEXT NOT NULL,
    "sourceReferences" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerMode" TEXT NOT NULL,
    "modelIdentifier" TEXT,
    "humanReviewStatus" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "AIReviewResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIGenerationRecord" (
    "id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceIds" TEXT NOT NULL,
    "generatedText" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerMode" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "AIGenerationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "StrategicObjective_code_key" ON "StrategicObjective"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingPeriod_code_key" ON "ReportingPeriod"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PaperType_code_key" ON "PaperType"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Template_code_key" ON "Template"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Template_supersedesId_key" ON "Template"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "User_entraObjectId_key" ON "User"("entraObjectId");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_departmentId_key" ON "UserRole"("userId", "roleId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_referenceNumber_key" ON "Activity"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityUpdate_supersedesId_key" ON "ActivityUpdate"("supersedesId");

-- CreateIndex
CREATE UNIQUE INDEX "Deadline_meetingId_key" ON "Deadline"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_referenceNumber_key" ON "Submission"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_smcSourceSubmissionId_key" ON "Submission"("smcSourceSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Resolution_resolutionNumber_key" ON "Resolution"("resolutionNumber");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workplan" ADD CONSTRAINT "Workplan_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workplan" ADD CONSTRAINT "Workplan_strategicObjectiveId_fkey" FOREIGN KEY ("strategicObjectiveId") REFERENCES "StrategicObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workplan" ADD CONSTRAINT "Workplan_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Workplan" ADD CONSTRAINT "Workplan_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workplanId_fkey" FOREIGN KEY ("workplanId") REFERENCES "Workplan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_strategicObjectiveId_fkey" FOREIGN KEY ("strategicObjectiveId") REFERENCES "StrategicObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_responsibleOfficerId_fkey" FOREIGN KEY ("responsibleOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUpdate" ADD CONSTRAINT "ActivityUpdate_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUpdate" ADD CONSTRAINT "ActivityUpdate_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUpdate" ADD CONSTRAINT "ActivityUpdate_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityUpdate" ADD CONSTRAINT "ActivityUpdate_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "ActivityUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_activityUpdateId_fkey" FOREIGN KEY ("activityUpdateId") REFERENCES "ActivityUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagementReport" ADD CONSTRAINT "ManagementReport_workplanId_fkey" FOREIGN KEY ("workplanId") REFERENCES "Workplan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_sponsoringDirectorId_fkey" FOREIGN KEY ("sponsoringDirectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_responsibleManagerId_fkey" FOREIGN KEY ("responsibleManagerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_smcSourceSubmissionId_fkey" FOREIGN KEY ("smcSourceSubmissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionVersion" ADD CONSTRAINT "SubmissionVersion_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionAnnexure" ADD CONSTRAINT "SubmissionAnnexure_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionReview" ADD CONSTRAINT "SubmissionReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "Decision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReviewResult" ADD CONSTRAINT "AIReviewResult_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReviewResult" ADD CONSTRAINT "AIReviewResult_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
