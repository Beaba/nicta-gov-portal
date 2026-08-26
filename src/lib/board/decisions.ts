import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole, AuthorizationError } from '@/lib/auth/rbac';
import { BOARD_MEMBER_ROLES } from '@/lib/board/roles';
import { isDecisionPaper } from '@/lib/config/paperTypes';
import type { AuthenticatedUser } from '@/lib/auth/types';

export class BoardDecisionValidationError extends Error {}

export const BOARD_DECISION_TYPES = [
  'Approve',
  'Reject',
  'Defer',
  'RequestFurtherInformation',
  'ApproveSubjectToConditions',
  'Abstain',
  'DeclareConflictOfInterest',
] as const;
export type BoardDecisionType = (typeof BOARD_DECISION_TYPES)[number];

const REQUIRES_COMMENT: readonly BoardDecisionType[] = [
  'Reject',
  'Defer',
  'RequestFurtherInformation',
  'DeclareConflictOfInterest',
];

/**
 * Records one Board Member's individual vote on a Decision Paper (#A30 — see the Decision model's
 * schema comment for why multiple rows per (submissionId, recordedById) are allowed rather than
 * updating in place: a changed vote is a new row, append-only, per this codebase's audit
 * convention). `conditions` is only meaningful for ApproveSubjectToConditions but is accepted
 * for any type and simply left null otherwise.
 */
export async function recordBoardDecision(
  submissionId: string,
  actingUser: AuthenticatedUser,
  input: { decisionType: BoardDecisionType; comment?: string; conditions?: string },
): Promise<void> {
  requireAnyRole(actingUser, BOARD_MEMBER_ROLES);

  if (REQUIRES_COMMENT.includes(input.decisionType) && !input.comment?.trim()) {
    throw new BoardDecisionValidationError(
      `A comment is required when recording "${input.decisionType}".`,
    );
  }

  const submission = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { meeting: true },
  });
  if (submission.submissionCategory !== 'BOARD') {
    throw new BoardDecisionValidationError('Decisions can only be recorded on a Board Paper.');
  }
  if (!isDecisionPaper(submission.paperType)) {
    throw new BoardDecisionValidationError('Only Decision Papers accept a Board decision.');
  }
  if (!submission.meetingId || !submission.meeting) {
    throw new BoardDecisionValidationError('This Board Paper has no linked meeting.');
  }

  const decision = await prisma.decision.create({
    data: {
      submissionId,
      meetingId: submission.meetingId,
      decisionType: input.decisionType,
      decisionDate: new Date(),
      recordedById: actingUser.id,
      notes: input.comment,
      conditions: input.conditions,
      submissionVersion: submission.currentVersion,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_DECISION_RECORDED',
    entityType: 'Submission',
    entityId: submissionId,
    newState: { decisionId: decision.id, decisionType: input.decisionType },
    correlationRef: submission.referenceNumber,
  });

  await getNotificationProvider().notify({
    userId: submission.createdById,
    type: 'BOARD_DECISION_RECORDED',
    message: `A Board Member recorded "${input.decisionType}" on ${submission.referenceNumber} "${submission.title}".`,
    linkUrl: `/submissions/${submission.id}`,
  });
}

/** Every decision ever recorded on a paper, newest first — the full audit trail, not just the
 * latest-per-user view approvalRules.ts computes an outcome from. */
export async function listDecisionsForSubmission(
  submissionId: string,
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, [...BOARD_MEMBER_ROLES, 'BOARD_SECRETARIAT']);
  return prisma.decision.findMany({
    where: { submissionId },
    orderBy: { decisionDate: 'desc' },
  });
}

/** The acting Board Member's own latest decision on this paper, or null if they haven't voted —
 * used to render "you already recorded X" instead of a blank form, and to compute the CEO
 * dashboard's "Decisions pending" count. */
export async function getMyLatestDecision(submissionId: string, actingUser: AuthenticatedUser) {
  if (
    !actingUser.roles.some((r) => (BOARD_MEMBER_ROLES as readonly string[]).includes(r.roleCode))
  ) {
    throw new AuthorizationError('Only a Board Member records a decision');
  }
  return prisma.decision.findFirst({
    where: { submissionId, recordedById: actingUser.id },
    orderBy: { decisionDate: 'desc' },
  });
}
