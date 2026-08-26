import { prisma } from '@/lib/db/prisma';
import { transitionSubmission } from '@/lib/submissions/workflow';
import { routeAcceptedSubmission } from '@/lib/submissions/routing';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { getDocumentStorageProvider } from '@/lib/providers/documentStorage';
import { scanUpload } from '@/lib/providers/documentStorage/malwareScan';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { requireAnyRole, AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { Submission } from '@prisma/client';
import { SubmissionValidationError } from '@/lib/submissions/submissions';

const REVIEWER_ROLES = ['REVIEWER_SECRETARIAT', 'SYSTEM_ADMIN'] as const;
const OVERSIGHT_ROLES = ['REVIEWER_SECRETARIAT', 'SYSTEM_ADMIN', 'EXECUTIVE_VIEWER'] as const;
// The CEO's substantive Board-escalation decision (#A27) is deliberately a separate role set from
// REVIEWER_ROLES — Corporate Secretariat's job stops at completeness ("Accept for SMC" /
// "Return for Correction"); only the CEO decides whether an accepted paper proceeds to Board.
// SYSTEM_ADMIN stays included for the same reason it's in every other role gate in this file: an
// emergency/testing override, not a governance role.
const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

async function acknowledgeLatestAIReview(submissionId: string): Promise<void> {
  const latest = await prisma.aIReviewResult.findFirst({
    where: { submissionId },
    orderBy: { reviewedAt: 'desc' },
  });
  if (latest && latest.humanReviewStatus === 'PENDING') {
    await prisma.aIReviewResult.update({
      where: { id: latest.id },
      data: { humanReviewStatus: 'ACKNOWLEDGED' },
    });
  }
}

export async function acceptSubmission(
  submissionId: string,
  actingUser: AuthenticatedUser,
  comment?: string,
): Promise<Submission> {
  requireAnyRole(actingUser, REVIEWER_ROLES);
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  if (submission.workflowStatus !== 'SECRETARIAT_REVIEW') {
    throw new SubmissionValidationError(
      `Cannot accept a submission in status ${submission.workflowStatus}`,
    );
  }

  await acknowledgeLatestAIReview(submission.id);

  await prisma.submissionReview.create({
    data: {
      submissionId: submission.id,
      reviewerId: actingUser.id,
      reviewerRole: 'REVIEWER_SECRETARIAT',
      outcome: 'Accepted',
      comments: comment,
    },
  });

  return transitionSubmission({
    submission,
    toState: 'ACCEPTED',
    performedById: actingUser.id,
    comment,
  });
}

export async function returnSubmissionForCorrection(
  submissionId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<Submission> {
  requireAnyRole(actingUser, REVIEWER_ROLES);
  if (!comment || comment.trim().length === 0) {
    throw new SubmissionValidationError(
      'A comment is required when returning a submission for correction.',
    );
  }

  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  if (submission.workflowStatus !== 'SECRETARIAT_REVIEW') {
    throw new SubmissionValidationError(
      `Cannot return a submission in status ${submission.workflowStatus}`,
    );
  }

  await acknowledgeLatestAIReview(submission.id);

  await prisma.submissionReview.create({
    data: {
      submissionId: submission.id,
      reviewerId: actingUser.id,
      reviewerRole: 'REVIEWER_SECRETARIAT',
      outcome: 'Returned',
      comments: comment,
    },
  });

  const updated = await transitionSubmission({
    submission,
    toState: 'RETURNED',
    performedById: actingUser.id,
    comment,
  });

  await getNotificationProvider().notify({
    userId: submission.createdById,
    type: 'SUBMISSION_RETURNED',
    message: `${submission.referenceNumber} "${submission.title}" was returned for correction: ${comment}`,
    linkUrl: `/submissions/${submission.id}`,
  });

  return updated;
}

/** Client requirement: reviewer "confirms or corrects the proposed document destination" then
 * "triggers final routing after acceptance." Milestone 1 destination is computed deterministically
 * from submission metadata (see routing.ts) rather than freely editable, so there is nothing to
 * "correct" beyond fixing the underlying metadata (department/meeting/paper type) — this action is
 * the confirm-and-trigger step. */
export async function routeSubmission(
  submissionId: string,
  actingUser: AuthenticatedUser,
): Promise<Submission> {
  requireAnyRole(actingUser, REVIEWER_ROLES);
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  if (submission.workflowStatus !== 'ACCEPTED') {
    throw new SubmissionValidationError(
      `Cannot route a submission in status ${submission.workflowStatus}`,
    );
  }
  return routeAcceptedSubmission(submission, actingUser.id);
}

export async function closeSubmission(
  submissionId: string,
  actingUser: AuthenticatedUser,
): Promise<Submission> {
  requireAnyRole(actingUser, REVIEWER_ROLES);
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  if (submission.workflowStatus !== 'ROUTED') {
    throw new SubmissionValidationError(
      `Cannot close a submission in status ${submission.workflowStatus}`,
    );
  }
  return transitionSubmission({ submission, toState: 'CLOSED', performedById: actingUser.id });
}

/**
 * The CEO's substantive decision that an accepted SMC paper should proceed to Board (#A27,
 * superseding `#A18`'s version of this function, which let Corporate Secretariat make this call —
 * the client was explicit that only the CEO may). Distinct from the paper actually reaching the
 * Board Papers register: setting this only unlocks the Director's ability to submit a Board Paper
 * (submitBoardPaper below). Not itself a workflowStatus transition (no fromState/toState), so it's
 * recorded as a plain audit event rather than a WorkflowTransition row. A comment is mandatory —
 * client requirement: "CEO comments must be stored against the submission... and sent... to the
 * responsible Director" — surfaced via the same in-app notification every other reviewer action
 * uses; a real email send requires a configured NOTIFICATION_PROVIDER=graph tenant, which this
 * environment doesn't have (see docs/known-limitations.md).
 */
export async function markEndorsedForBoard(
  submissionId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<Submission> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (!comment || comment.trim().length === 0) {
    throw new SubmissionValidationError('A comment is required when vetting a paper for Board.');
  }
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  if (submission.workflowStatus !== 'ACCEPTED' && submission.workflowStatus !== 'ROUTED') {
    throw new SubmissionValidationError('Only an accepted submission can be vetted for Board.');
  }

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: {
      endorsedForBoard: true,
      endorsedForBoardAt: new Date(),
      endorsedForBoardById: actingUser.id,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SUBMISSION_ENDORSED_FOR_BOARD',
    entityType: 'Submission',
    entityId: submission.id,
    newState: { endorsedForBoard: true, comment },
    correlationRef: submission.referenceNumber,
  });

  await getNotificationProvider().notify({
    userId: submission.createdById,
    type: 'SUBMISSION_ENDORSED_FOR_BOARD',
    message: `${submission.referenceNumber} "${submission.title}" was vetted for Board by the CEO: ${comment} — submit a Board Paper summarising the discussion.`,
    linkUrl: `/submissions/${submission.id}`,
  });

  return updated;
}

/**
 * The CEO's other substantive outcome — reviewed, and explicitly decided this paper should NOT
 * proceed to Board (stays informational at SMC level). Without this, an accepted-but-unreviewed
 * paper and a reviewed-and-declined paper are indistinguishable (`endorsedForBoard: false` means
 * both). Recorded as a plain audit event, the same way `markEndorsedForBoard` is — `#A27`'s
 * `listSubmissionsAwaitingCeoReview` below excludes anything with this event so it drops off the
 * CEO's "awaiting review" list once decided either way.
 */
export async function markNotVettedForBoard(
  submissionId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<void> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (!comment || comment.trim().length === 0) {
    throw new SubmissionValidationError(
      'A comment is required when marking a paper not vetted for Board.',
    );
  }
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  if (submission.workflowStatus !== 'ACCEPTED' && submission.workflowStatus !== 'ROUTED') {
    throw new SubmissionValidationError('Only an accepted submission can be reviewed by the CEO.');
  }

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SUBMISSION_NOT_VETTED_FOR_BOARD',
    entityType: 'Submission',
    entityId: submission.id,
    newState: { endorsedForBoard: false, comment },
    correlationRef: submission.referenceNumber,
  });

  await getNotificationProvider().notify({
    userId: submission.createdById,
    type: 'SUBMISSION_NOT_VETTED_FOR_BOARD',
    message: `${submission.referenceNumber} "${submission.title}" was reviewed by the CEO and will not proceed to Board: ${comment}`,
    linkUrl: `/submissions/${submission.id}`,
  });
}

/** SMC submissions the CEO has not yet vetted either way — `ACCEPTED`/`ROUTED`, not already
 * endorsed, and with no prior `SUBMISSION_NOT_VETTED_FOR_BOARD` decision recorded. */
export async function listSubmissionsAwaitingCeoReview(actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, CEO_ROLES);
  const declined = await prisma.auditEvent.findMany({
    where: { entityType: 'Submission', action: 'SUBMISSION_NOT_VETTED_FOR_BOARD' },
    select: { entityId: true },
  });
  const declinedIds = declined
    .map((d) => d.entityId)
    .filter((id): id is string => id !== null && id !== undefined);

  return prisma.submission.findMany({
    where: {
      submissionCategory: 'SMC',
      workflowStatus: { in: ['ACCEPTED', 'ROUTED'] },
      endorsedForBoard: false,
      ...(declinedIds.length > 0 ? { id: { notIn: declinedIds } } : {}),
    },
    include: { department: true },
    orderBy: { submittedAt: 'asc' },
  });
}

/**
 * The Board Paper itself — a distinct Submission (category BOARD) the Director authors "based on
 * the [SEMC] comments" once endorsed, not a status flip on the SEMC paper. Reuses
 * smcSourceSubmissionId/boardSubmission (already in the schema for this exact purpose) and the
 * "BP" reference scope. Deliberately skips AI template review and the SECRETARIAT_REVIEW queue —
 * the client only asked for AI vetting on the SEMC paper, and SEMC has already reviewed the
 * underlying content — so this lands directly at SUBMITTED, visible on the Board Papers register.
 */
export async function submitBoardPaper(
  sourceSubmissionId: string,
  input: { boardSummary: string; file: { buffer: Buffer; fileName: string; contentType: string } },
  actingUser: AuthenticatedUser,
): Promise<Submission> {
  requireAnyRole(actingUser, ['SUBMITTER']);
  const source = await prisma.submission.findUniqueOrThrow({
    where: { id: sourceSubmissionId },
    include: { boardSubmission: true },
  });
  if (source.createdById !== actingUser.id) {
    throw new AuthorizationError(
      'Only the original submitter may submit the Board Paper for this SEMC paper',
    );
  }
  if (!source.endorsedForBoard) {
    throw new SubmissionValidationError('SEMC has not endorsed this paper for Board yet.');
  }
  if (source.boardSubmission) {
    throw new SubmissionValidationError(
      'A Board Paper has already been submitted for this SEMC paper.',
    );
  }

  const scan = await scanUpload({
    buffer: input.file.buffer,
    contentType: input.file.contentType,
    sizeBytes: input.file.buffer.byteLength,
  });
  if (scan.status !== 'CLEAN') {
    throw new SubmissionValidationError(
      `Upload rejected: ${scan.status}${scan.reason ? ` — ${scan.reason}` : ''}`,
    );
  }

  const [meeting, department, year] = await Promise.all([
    source.meetingId
      ? prisma.meeting.findUnique({ where: { id: source.meetingId } })
      : Promise.resolve(null),
    prisma.department.findUnique({ where: { id: source.departmentId } }),
    Promise.resolve(new Date().getFullYear().toString()),
  ]);
  const referenceNumber = await nextReferenceNumber('BP', year);
  // TODO: an endorsed-for-Board SEMC paper is always expected to have a linked meeting by this
  // point, but fall back to the source submission's createdAt rather than throw if that's ever
  // not the case — see docs/known-limitations.md.
  const meetingDate = (meeting?.meetingDate ?? source.createdAt).toISOString();
  const meetingNumber = meeting?.meetingNumber ?? 'NO-MEETING';

  const storage = getDocumentStorageProvider();
  const stored = await storage.upload({
    buffer: input.file.buffer,
    fileName: input.file.fileName,
    contentType: input.file.contentType,
    placement: {
      kind: 'BOARD_MAIN',
      referenceNumber,
      // Slugged from the *source* SMC submission's title, not this Board Paper's own "Board
      // Paper: ..." title — see the matching note on buildPlacement in routing.ts, which must
      // resolve the same title so its routing preview matches where the file actually lives.
      title: source.title,
      // Client's file-naming requirement ("Department Name, SMC Date, Sitting number") applies to
      // Board Paper files too — using the Board Paper's own department, inherited from its SMC
      // source (see submitBoardPaper's `departmentId: source.departmentId` a few lines below).
      departmentName: department?.name ?? 'Unfiled',
      meetingDate,
      meetingNumber,
      fileName: input.file.fileName,
    },
  });

  const boardPaper = await prisma.submission.create({
    data: {
      referenceNumber,
      submissionCategory: 'BOARD',
      paperType: source.paperType,
      title: `Board Paper: ${source.title}`,
      departmentId: source.departmentId,
      createdById: actingUser.id,
      responsibleManagerId: actingUser.id,
      meetingId: source.meetingId,
      confidentiality: source.confidentiality,
      purpose: input.boardSummary,
      templateId: source.templateId,
      smcSourceSubmissionId: source.id,
      mainDocumentStorageKey: stored.storageKey,
      mainDocumentFileName: stored.fileName,
      submittedAt: new Date(),
      workflowStatus: 'SUBMITTED',
    },
  });

  await prisma.evidence.create({
    data: {
      fileName: stored.fileName,
      storageKey: stored.storageKey,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      uploadedById: actingUser.id,
      submissionId: boardPaper.id,
      role: 'MAIN_PAPER',
      scanStatus: 'CLEAN',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_PAPER_SUBMITTED',
    entityType: 'Submission',
    entityId: boardPaper.id,
    newState: { referenceNumber, sourceSubmissionId: source.id },
    correlationRef: referenceNumber,
  });

  // Files a small generated text artifact recording which SMC submission this Board Paper came
  // from (03_SMC_Source/Source-Reference.txt in the exact hierarchy). There's no dedicated schema
  // column to record its storageKey against (and adding one is out of scope here — see CLAUDE.md),
  // so this is a fire-and-forget filed artifact: a failure here must not fail the Board Paper
  // submission itself, which is already fully recorded by this point.
  try {
    await storage.upload({
      buffer: Buffer.from(
        `Source SMC Submission: ${source.referenceNumber}\nTitle: ${source.title}\n`,
      ),
      fileName: 'Source-Reference.txt',
      contentType: 'text/plain',
      placement: {
        kind: 'BOARD_SMC_SOURCE',
        referenceNumber,
        title: source.title,
        meetingDate,
        fileName: 'Source-Reference.txt',
      },
    });
  } catch (err) {
    console.error(`Failed to file Source-Reference.txt for Board Paper ${referenceNumber}:`, err);
  }

  return boardPaper;
}

// #A30: a Board Member only sees Board Papers attached to a published (or later) Board meeting —
// same visibility boundary as assertCanAccessSubmission in submissions.ts, applied here too since
// this register lists many papers at once rather than checking access to a single one.
export async function listBoardPapers(
  actingUser?: AuthenticatedUser,
): Promise<(Submission & { smcSourceSubmission: Submission | null })[]> {
  const isBoardMemberOnly =
    actingUser !== undefined &&
    actingUser.roles.some((r) => r.roleCode === 'BOARD_MEMBER') &&
    !actingUser.roles.some(
      (r) =>
        r.roleCode === 'REVIEWER_SECRETARIAT' ||
        r.roleCode === 'SYSTEM_ADMIN' ||
        r.roleCode === 'EXECUTIVE_VIEWER' ||
        r.roleCode === 'BOARD_SECRETARIAT',
    );

  return prisma.submission.findMany({
    where: {
      submissionCategory: 'BOARD',
      ...(isBoardMemberOnly
        ? { meeting: { status: { in: ['PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'] } } }
        : {}),
    },
    include: { smcSourceSubmission: true },
    orderBy: { submittedAt: 'desc' },
  });
}

/**
 * Action items (docs/mvp-directors-portal-plan.md#A18): the CEO and Corporate Secretary can attach
 * a description + optional due date directly to any paper — reuses the existing ActionItem model
 * (previously only reachable via a formal Decision record) with a direct submissionId instead, so
 * this doesn't require recording a Decision first.
 */
export async function addActionItem(
  submissionId: string,
  input: { description: string; dueDate?: Date },
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, OVERSIGHT_ROLES);
  if (!input.description || input.description.trim().length === 0) {
    throw new SubmissionValidationError('Action item description is required.');
  }
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });

  const actionItem = await prisma.actionItem.create({
    data: {
      submissionId: submission.id,
      createdById: actingUser.id,
      description: input.description.trim(),
      dueDate: input.dueDate,
      status: 'OPEN',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'ACTION_ITEM_ADDED',
    entityType: 'Submission',
    entityId: submission.id,
    newState: { description: input.description, dueDate: input.dueDate },
    correlationRef: submission.referenceNumber,
  });

  return actionItem;
}

export async function listActionItems(submissionId: string) {
  return prisma.actionItem.findMany({ where: { submissionId }, orderBy: { createdAt: 'desc' } });
}

/** CEO/Corporate Secretary org-wide read visibility ("CEO reviews and reads") — unscoped by
 * department or ownership, unlike listMySubmissions. */
export async function listAllSubmissions(actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, OVERSIGHT_ROLES);
  return prisma.submission.findMany({
    include: { department: true },
    orderBy: { createdAt: 'desc' },
  });
}
