import { prisma } from '@/lib/db/prisma';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import { transitionSubmission } from '@/lib/submissions/workflow';
import { getCurrentSmcMeeting } from '@/lib/submissions/meetings';
import { getAIReviewProvider } from '@/lib/providers/aiReview';
import { getDocumentStorageProvider } from '@/lib/providers/documentStorage';
import { scanUpload } from '@/lib/providers/documentStorage/malwareScan';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { requireAnyRole, canAccessDepartment, AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { ConfidentialityLevel, Submission } from '@prisma/client';

export class SubmissionValidationError extends Error {}

export interface CreateSubmissionInput {
  /** Client requirement: submitters select an approved NICTA template, not a bare paper-type
   * string — see docs/mvp-directors-portal-plan.md. `paperType` is derived from the template. */
  templateId: string;
  title: string;
  departmentId: string;
  confidentiality?: ConfidentialityLevel;
  purpose?: string;
  recommendation?: string;
  proposedDecision?: string;
  executiveSummary?: string;
  responsibleManagerId?: string;
}

function assertCanAccessSubmission(submission: Submission, user: AuthenticatedUser): void {
  const isOwner = submission.createdById === user.id;
  // CEO ("reviews and reads") gets org-wide read access alongside the Corporate Secretary/Admin —
  // see docs/mvp-directors-portal-plan.md#A18.
  const hasOversight = user.roles.some(
    (r) =>
      r.roleCode === 'REVIEWER_SECRETARIAT' ||
      r.roleCode === 'SYSTEM_ADMIN' ||
      r.roleCode === 'EXECUTIVE_VIEWER',
  );
  if (!isOwner && !hasOversight) {
    throw new AuthorizationError('No access to this submission');
  }
}

export async function createDraftSubmission(
  input: CreateSubmissionInput,
  actingUser: AuthenticatedUser,
): Promise<Submission> {
  requireAnyRole(actingUser, ['SUBMITTER']);
  if (!canAccessDepartment(actingUser, input.departmentId)) {
    throw new AuthorizationError('No access to this department');
  }
  const template = await prisma.template.findUnique({ where: { id: input.templateId } });
  if (!template || !template.isActive || !template.paperType) {
    throw new SubmissionValidationError('Select a currently approved template.');
  }
  const meeting = await getCurrentSmcMeeting();
  if (!meeting) {
    throw new SubmissionValidationError('No SMC meeting is currently open for submissions.');
  }

  const year = new Date().getFullYear().toString();
  const referenceNumber = await nextReferenceNumber('SMC', year);

  const submission = await prisma.submission.create({
    data: {
      referenceNumber,
      submissionCategory: 'SMC',
      paperType: template.paperType,
      templateId: template.id,
      title: input.title,
      departmentId: input.departmentId,
      createdById: actingUser.id,
      responsibleManagerId: input.responsibleManagerId ?? actingUser.id,
      meetingId: meeting.id,
      confidentiality: input.confidentiality ?? 'INTERNAL',
      purpose: input.purpose,
      recommendation: input.recommendation,
      proposedDecision: input.proposedDecision,
      executiveSummary: input.executiveSummary,
      workflowStatus: 'DRAFT',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SUBMISSION_CREATED',
    entityType: 'Submission',
    entityId: submission.id,
    newState: { referenceNumber, paperType: template.paperType, templateId: template.id },
    correlationRef: referenceNumber,
  });

  return submission;
}

/**
 * Orchestrates create + upload + submit as the single action the reference design's "Upload
 * completed paper" modal performs (title + template + file → "Submit to SMC") — see
 * docs/mvp-directors-portal-plan.md. Reuses the three granular functions above unchanged rather
 * than duplicating their logic, per docs/assumptions-and-decisions.md#A16's "preserve working
 * foundations" instruction.
 */
export async function createAndSubmitPaper(
  input: CreateSubmissionInput,
  file: { buffer: Buffer; fileName: string; contentType: string },
  actingUser: AuthenticatedUser,
  annexures: { buffer: Buffer; fileName: string; contentType: string; title: string }[] = [],
) {
  const draft = await createDraftSubmission(input, actingUser);
  await uploadMainDocument(draft.id, file, actingUser);
  for (const annexure of annexures) {
    await uploadAnnexure(draft.id, annexure, actingUser);
  }
  return submitSubmission(draft.id, actingUser);
}

/** Uploads (or replaces, on a RETURNED resubmission) the main paper. Scans before storing —
 * client's "route to SharePoint only after malware scanning" control point applies to every
 * upload, not only the final routing step. */
export async function uploadMainDocument(
  submissionId: string,
  file: { buffer: Buffer; fileName: string; contentType: string },
  actingUser: AuthenticatedUser,
): Promise<Submission> {
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  assertCanAccessSubmission(submission, actingUser);
  if (submission.createdById !== actingUser.id) {
    throw new AuthorizationError('Only the submission owner may upload the main document');
  }
  if (submission.workflowStatus !== 'DRAFT' && submission.workflowStatus !== 'RETURNED') {
    throw new SubmissionValidationError(
      `Cannot upload a document while submission is ${submission.workflowStatus}`,
    );
  }

  const scan = await scanUpload({
    buffer: file.buffer,
    contentType: file.contentType,
    sizeBytes: file.buffer.byteLength,
  });
  if (scan.status !== 'CLEAN') {
    throw new SubmissionValidationError(
      `Upload rejected: ${scan.status}${scan.reason ? ` — ${scan.reason}` : ''}`,
    );
  }

  const [department, meeting] = await Promise.all([
    prisma.department.findUnique({ where: { id: submission.departmentId } }),
    submission.meetingId
      ? prisma.meeting.findUnique({ where: { id: submission.meetingId } })
      : Promise.resolve(null),
  ]);
  // TODO: a submission is always expected to have a linked meeting by the time a document is
  // uploaded (createDraftSubmission requires one), but fall back to createdAt rather than throw
  // if that's ever not the case — see docs/known-limitations.md.
  const meetingDate = (meeting?.meetingDate ?? submission.createdAt).toISOString();

  const storage = getDocumentStorageProvider();
  const stored = await storage.upload({
    buffer: file.buffer,
    fileName: file.fileName,
    contentType: file.contentType,
    placement: {
      kind: 'SMC_MAIN',
      referenceNumber: submission.referenceNumber,
      title: submission.title,
      departmentName: department?.name ?? 'Unfiled',
      meetingDate,
      isLate: submission.isLate,
      fileName: file.fileName,
    },
  });

  const isResubmission = submission.workflowStatus === 'RETURNED';
  const nextVersion = isResubmission ? submission.currentVersion + 1 : submission.currentVersion;

  await prisma.evidence.create({
    data: {
      fileName: stored.fileName,
      storageKey: stored.storageKey,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      uploadedById: actingUser.id,
      submissionId: submission.id,
      role: 'MAIN_PAPER',
      scanStatus: 'CLEAN',
    },
  });

  if (isResubmission) {
    await prisma.submissionVersion.create({
      data: {
        submissionId: submission.id,
        versionNumber: submission.currentVersion,
        snapshotJson: JSON.stringify(submission),
        createdById: actingUser.id,
      },
    });
  }

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      mainDocumentStorageKey: stored.storageKey,
      mainDocumentFileName: stored.fileName,
      currentVersion: nextVersion,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: isResubmission ? 'SUBMISSION_DOCUMENT_RESUBMITTED' : 'SUBMISSION_DOCUMENT_UPLOADED',
    entityType: 'Submission',
    entityId: submission.id,
    newState: { fileName: stored.fileName, version: nextVersion },
    correlationRef: submission.referenceNumber,
  });

  return updated;
}

export async function uploadAnnexure(
  submissionId: string,
  file: { buffer: Buffer; fileName: string; contentType: string; title: string },
  actingUser: AuthenticatedUser,
): Promise<void> {
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  if (submission.createdById !== actingUser.id) {
    throw new AuthorizationError('Only the submission owner may upload annexures');
  }
  if (submission.workflowStatus !== 'DRAFT' && submission.workflowStatus !== 'RETURNED') {
    throw new SubmissionValidationError(
      `Cannot upload an annexure while submission is ${submission.workflowStatus}`,
    );
  }

  const scan = await scanUpload({
    buffer: file.buffer,
    contentType: file.contentType,
    sizeBytes: file.buffer.byteLength,
  });
  if (scan.status !== 'CLEAN') {
    throw new SubmissionValidationError(
      `Upload rejected: ${scan.status}${scan.reason ? ` — ${scan.reason}` : ''}`,
    );
  }

  // existingCount doubles as this annexure's order/letter — fetched before upload (rather than
  // after, as before) because the new folder-placement logic needs the order to compute the
  // ANNEX-{letter} destination file name.
  const [department, meeting, existingCount] = await Promise.all([
    prisma.department.findUnique({ where: { id: submission.departmentId } }),
    submission.meetingId
      ? prisma.meeting.findUnique({ where: { id: submission.meetingId } })
      : Promise.resolve(null),
    prisma.submissionAnnexure.count({ where: { submissionId: submission.id } }),
  ]);
  // TODO: see the matching TODO in uploadMainDocument above re: the meetingId-null fallback.
  const meetingDate = (meeting?.meetingDate ?? submission.createdAt).toISOString();

  const storage = getDocumentStorageProvider();
  const stored = await storage.upload({
    buffer: file.buffer,
    fileName: file.fileName,
    contentType: file.contentType,
    placement: {
      kind: 'SMC_ANNEXURE',
      referenceNumber: submission.referenceNumber,
      title: submission.title,
      departmentName: department?.name ?? 'Unfiled',
      meetingDate,
      isLate: submission.isLate,
      annexureOrder: existingCount,
      fileName: file.fileName,
    },
  });

  await prisma.$transaction([
    prisma.submissionAnnexure.create({
      data: {
        submissionId: submission.id,
        title: file.title,
        storageKey: stored.storageKey,
        order: existingCount,
      },
    }),
    prisma.evidence.create({
      data: {
        fileName: stored.fileName,
        storageKey: stored.storageKey,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        uploadedById: actingUser.id,
        submissionId: submission.id,
        role: 'ANNEXURE',
        scanStatus: 'CLEAN',
      },
    }),
  ]);
}

/**
 * Submits a draft/returned submission and immediately runs it through AI template review,
 * landing it in the secretariat review queue — the DRAFT/RETURNED -> SUBMITTED -> AI_REVIEWED ->
 * SECRETARIAT_REVIEW chain is one client-facing action (client requirement: AI review is
 * system-triggered, not a manual step). AI review is advisory only and never blocks this chain —
 * see docs/milestone-1-plan.md.
 */
export async function submitSubmission(submissionId: string, actingUser: AuthenticatedUser) {
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  requireAnyRole(actingUser, ['SUBMITTER']);
  if (submission.createdById !== actingUser.id) {
    throw new AuthorizationError('Only the submission owner may submit it');
  }
  if (!submission.mainDocumentStorageKey || !submission.mainDocumentFileName) {
    throw new SubmissionValidationError('Upload the main document before submitting.');
  }
  if (!submission.meetingId) {
    throw new SubmissionValidationError('Select the intended meeting before submitting.');
  }
  const mainDocumentFileName = submission.mainDocumentFileName;

  let current = await transitionSubmission({
    submission,
    toState: 'SUBMITTED',
    performedById: actingUser.id,
    comment: 'Submitted by submitter',
  });
  current = await prisma.submission.update({
    where: { id: current.id },
    data: { submittedAt: new Date() },
  });

  const mainDocumentEvidence = await prisma.evidence.findFirst({
    where: { submissionId: current.id, role: 'MAIN_PAPER' },
    orderBy: { uploadedAt: 'desc' },
  });

  const provider = getAIReviewProvider();
  const reviewInput = {
    submissionId: current.id,
    paperType: current.paperType,
    title: current.title,
    purpose: current.purpose,
    recommendation: current.recommendation,
    proposedDecision: current.proposedDecision,
    executiveSummary: current.executiveSummary,
    mainDocumentFileName,
    mainDocumentContentType:
      mainDocumentEvidence?.contentType ??
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    templateName: current.templateId,
  };

  const reviewOutput = await provider.review(reviewInput);
  const aiReviewResult = await prisma.aIReviewResult.create({
    data: {
      submissionId: current.id,
      templateId: current.templateId,
      overallResult: reviewOutput.overallResult,
      missingSections: JSON.stringify(reviewOutput.missingSections),
      warnings: JSON.stringify(reviewOutput.warnings),
      suggestedCorrections: JSON.stringify(reviewOutput.suggestedCorrections),
      sourceReferences: JSON.stringify(reviewOutput.sourceReferences),
      providerMode: provider.providerName,
      modelIdentifier: reviewOutput.modelIdentifier,
    },
  });

  const draft = await provider.generateTemplatedDraft(reviewInput);
  if (draft) {
    const [department, meeting] = await Promise.all([
      prisma.department.findUnique({ where: { id: current.departmentId } }),
      current.meetingId
        ? prisma.meeting.findUnique({ where: { id: current.meetingId } })
        : Promise.resolve(null),
    ]);
    // TODO: see the matching TODO in uploadMainDocument above re: the meetingId-null fallback.
    const meetingDate = (meeting?.meetingDate ?? current.createdAt).toISOString();

    const storage = getDocumentStorageProvider();
    const stored = await storage.upload({
      buffer: draft.buffer,
      fileName: draft.fileName,
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      placement: {
        // The AI-generated templated draft is this submission's "reviewed output" slot in the
        // client's exact hierarchy (03_Reviewed_Output/{ReferenceNumber}_Reviewed.docx).
        kind: 'SMC_REVIEWED_OUTPUT',
        referenceNumber: current.referenceNumber,
        title: current.title,
        departmentName: department?.name ?? 'Unfiled',
        meetingDate,
        isLate: current.isLate,
        fileName: draft.fileName,
      },
    });
    await prisma.evidence.create({
      data: {
        fileName: stored.fileName,
        storageKey: stored.storageKey,
        contentType: stored.contentType,
        sizeBytes: stored.sizeBytes,
        uploadedById: actingUser.id,
        submissionId: current.id,
        role: 'GENERATED_DRAFT',
        scanStatus: 'SKIPPED_MOCK',
      },
    });
    current = await prisma.submission.update({
      where: { id: current.id },
      data: { generatedDraftStorageKey: stored.storageKey },
    });
  }

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SUBMISSION_AI_REVIEWED',
    entityType: 'Submission',
    entityId: current.id,
    newState: { overallResult: reviewOutput.overallResult, providerMode: provider.providerName },
    correlationRef: current.referenceNumber,
  });

  current = await transitionSubmission({
    submission: current,
    toState: 'AI_REVIEWED',
    performedById: actingUser.id,
    comment: `AI template review complete: ${reviewOutput.overallResult}`,
  });
  current = await transitionSubmission({
    submission: current,
    toState: 'SECRETARIAT_REVIEW',
    performedById: actingUser.id,
    comment: 'Routed to secretariat review queue',
  });

  return { submission: current, aiReviewResult };
}

export async function getSubmissionForUser(
  submissionId: string,
  actingUser: AuthenticatedUser,
): Promise<Submission> {
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  assertCanAccessSubmission(submission, actingUser);
  return submission;
}

export async function listMySubmissions(actingUser: AuthenticatedUser): Promise<Submission[]> {
  return prisma.submission.findMany({
    where: { createdById: actingUser.id },
    orderBy: { createdAt: 'desc' },
  });
}

export async function listReviewQueue(actingUser: AuthenticatedUser): Promise<Submission[]> {
  requireAnyRole(actingUser, ['REVIEWER_SECRETARIAT', 'SYSTEM_ADMIN']);
  return prisma.submission.findMany({
    where: { workflowStatus: 'SECRETARIAT_REVIEW' },
    orderBy: { submittedAt: 'asc' },
  });
}
