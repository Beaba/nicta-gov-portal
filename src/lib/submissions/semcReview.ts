import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';

const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

export class SemcReviewValidationError extends Error {}

// #A32 — the CEO's real, distinct pre-meeting SEMC actions
// (docs/ceo-portal-requirements-review.md's SEMC-7 finding: the client's spec assigns these 6
// verbs to the CEO, but the only 4 that existed in code — accept/return/route/close — were
// Secretariat-gated). `ceoAgendaStatus` is a new, additive field on Submission, deliberately kept
// separate from both `workflowStatus` (the Secretariat's completeness-check state machine, #A1/
// #A27, unchanged) and `endorsedForBoard`/`boardOutcome` (the CEO's separate, later Board-vetting
// decision, #A27/#A30, also unchanged) — this operates one layer earlier, on whether a
// Secretariat-vetted SMC/SEMC paper proceeds onto the CEO-chaired meeting's agenda at all.
export const SEMC_AGENDA_STATES = [
  'AWAITING_CEO_REVIEW',
  'ACCEPTED_FOR_AGENDA',
  'RETURNED',
  'MORE_INFORMATION_REQUESTED',
  'REJECTED',
  'CLOSED',
] as const;
export type SemcAgendaState = (typeof SEMC_AGENDA_STATES)[number];

async function requireVettedSubmission(submissionId: string) {
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  if (submission.submissionCategory !== 'SMC') {
    throw new SemcReviewValidationError('Only an SMC/SEMC report can go through CEO agenda review.');
  }
  if (!['ACCEPTED', 'ROUTED'].includes(submission.workflowStatus)) {
    throw new SemcReviewValidationError('The Corporate Secretariat must vet this report before CEO review.');
  }
  return submission;
}

async function ceoSetAgendaStatus(
  submissionId: string,
  actingUser: AuthenticatedUser,
  toState: SemcAgendaState,
  comment: string | undefined,
  requireComment: boolean,
  action: string,
  notifyMessage: (title: string) => string,
) {
  requireAnyRole(actingUser, CEO_ROLES);
  if (requireComment && !comment?.trim()) {
    throw new SemcReviewValidationError('A comment is required for this action.');
  }
  const submission = await requireVettedSubmission(submissionId);

  const updated = await prisma.submission.update({
    where: { id: submissionId },
    data: { ceoAgendaStatus: toState, ceoAgendaStatusAt: new Date(), ceoAgendaStatusById: actingUser.id },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action,
    entityType: 'Submission',
    entityId: submissionId,
    previousState: { ceoAgendaStatus: submission.ceoAgendaStatus },
    newState: { ceoAgendaStatus: toState, comment },
    correlationRef: submission.referenceNumber,
  });

  if (comment) {
    await prisma.comment.create({
      data: {
        entityType: 'Submission',
        entityId: submissionId,
        authorId: actingUser.id,
        body: comment,
        visibility: 'BOARD_AND_SECRETARIAT',
      },
    });
  }

  await getNotificationProvider().notify({
    userId: submission.createdById,
    type: action,
    message: notifyMessage(submission.title),
    linkUrl: `/submissions/${submissionId}`,
  });

  return updated;
}

export const acceptForSemcAgenda = (id: string, actingUser: AuthenticatedUser, comment?: string) =>
  ceoSetAgendaStatus(
    id,
    actingUser,
    'ACCEPTED_FOR_AGENDA',
    comment,
    false,
    'SEMC_ACCEPTED_FOR_AGENDA',
    (title) => `"${title}" was accepted for the SEMC agenda by the CEO.`,
  );

export const returnSemcSubmissionToDirector = (id: string, actingUser: AuthenticatedUser, comment: string) =>
  ceoSetAgendaStatus(
    id,
    actingUser,
    'RETURNED',
    comment,
    true,
    'SEMC_RETURNED_TO_DIRECTOR',
    (title) => `"${title}" was returned to you by the CEO: see comments.`,
  );

export const requestSemcMoreInformation = (id: string, actingUser: AuthenticatedUser, comment: string) =>
  ceoSetAgendaStatus(
    id,
    actingUser,
    'MORE_INFORMATION_REQUESTED',
    comment,
    true,
    'SEMC_MORE_INFORMATION_REQUESTED',
    (title) => `The CEO requested more information on "${title}".`,
  );

export const addSemcPreliminaryComment = (id: string, actingUser: AuthenticatedUser, comment: string) =>
  ceoSetAgendaStatus(
    id,
    actingUser,
    'AWAITING_CEO_REVIEW',
    comment,
    true,
    'SEMC_PRELIMINARY_COMMENT_ADDED',
    (title) => `The CEO added a preliminary comment on "${title}".`,
  );

export const rejectSemcSubmission = (id: string, actingUser: AuthenticatedUser, comment: string) =>
  ceoSetAgendaStatus(
    id,
    actingUser,
    'REJECTED',
    comment,
    true,
    'SEMC_REJECTED',
    (title) => `"${title}" was rejected by the CEO: see comments.`,
  );

export const closeSemcSubmission = (id: string, actingUser: AuthenticatedUser, comment?: string) =>
  ceoSetAgendaStatus(
    id,
    actingUser,
    'CLOSED',
    comment,
    false,
    'SEMC_CLOSED',
    (title) => `"${title}" was closed by the CEO.`,
  );

/** SEMC reports vetted by the Secretariat, awaiting the CEO's pre-meeting review — the CEO's
 * primary SEMC queue (Screen 2's "SEMC Reports for CEO Review" table). */
export async function listSemcReportsForCeoReview(actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, CEO_ROLES);
  return prisma.submission.findMany({
    where: {
      submissionCategory: 'SMC',
      workflowStatus: { in: ['ACCEPTED', 'ROUTED'] },
      OR: [
        { ceoAgendaStatus: null },
        { ceoAgendaStatus: { in: ['AWAITING_CEO_REVIEW', 'MORE_INFORMATION_REQUESTED'] } },
      ],
    },
    include: { department: true, createdBy: true, meeting: true },
    orderBy: { submittedAt: 'desc' },
  });
}

/**
 * Step 1 of the client's two-step Board escalation: "SEMC recommends, CEO confirms." Distinct
 * from `endorsedForBoard` (the CEO's own confirmation, #A27/#A30) — this is the earlier
 * Secretariat-recorded SEMC recommendation. Reuses the existing REVIEWER_ROLES gate pattern from
 * review.ts (Corporate Secretariat = SEMC Secretariat).
 */
export async function recommendBoardEscalation(
  submissionId: string,
  actingUser: AuthenticatedUser,
  reason: string,
): Promise<void> {
  requireAnyRole(actingUser, ['REVIEWER_SECRETARIAT', 'SYSTEM_ADMIN']);
  if (!reason.trim()) throw new SemcReviewValidationError('Explain why Board escalation is recommended.');
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      semcEscalationRecommended: true,
      semcEscalationRecommendedAt: new Date(),
      semcEscalationRecommendedById: actingUser.id,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_BOARD_ESCALATION_RECOMMENDED',
    entityType: 'Submission',
    entityId: submissionId,
    newState: { reason },
    correlationRef: submission.referenceNumber,
  });
}
