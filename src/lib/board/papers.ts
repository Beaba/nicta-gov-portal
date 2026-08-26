import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { requireAnyRole } from '@/lib/auth/rbac';
import { BOARD_SECRETARIAT_ROLES, BOARD_ANY_ROLES } from '@/lib/board/roles';
import { isDecisionPaper } from '@/lib/config/paperTypes';
import { evaluateBoardOutcome, type BoardOutcomeSuggestion } from '@/lib/board/approvalRules';
import type { AuthenticatedUser } from '@/lib/auth/types';

export class BoardPaperValidationError extends Error {}

/**
 * Board Dashboard papers register — only Submissions with `submissionCategory: 'BOARD'` ever
 * exist, and those are only ever created via submitBoardPaper() once the source SMC paper's
 * `endorsedForBoard` is true (review.ts) — so "only papers that passed the CEO/Secretariat
 * workflow" is already the existing invariant, not something this module needs to re-check.
 * Restricted here to papers linked to a meeting the acting user can actually see (a Board Member
 * must not see a Board Paper attached to a still-DRAFT meeting).
 */
export async function listBoardDashboardPapers(actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, BOARD_ANY_ROLES);
  const isSecretariat = actingUser.roles.some((r) =>
    (BOARD_SECRETARIAT_ROLES as readonly string[]).includes(r.roleCode),
  );

  return prisma.submission.findMany({
    where: {
      submissionCategory: 'BOARD',
      ...(isSecretariat
        ? {}
        : { meeting: { status: { in: ['PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'] } } }),
    },
    include: { department: true, meeting: true, smcSourceSubmission: true },
    orderBy: { submittedAt: 'desc' },
  });
}

/** The CEO's comment recorded when vetting the *source* SMC paper for Board (#A27's
 * markEndorsedForBoard/markNotVettedForBoard) — there is no dedicated column for it, only an
 * AuditEvent with the comment inside its JSON `newState`, so this parses it back out. Returns the
 * most recent one, in case the CEO's decision was ever re-recorded. */
export async function getCeoCommentForBoardPaper(
  smcSourceSubmissionId: string | null,
): Promise<{ comment: string; recordedAt: Date; action: string } | null> {
  if (!smcSourceSubmissionId) return null;
  const event = await prisma.auditEvent.findFirst({
    where: {
      entityType: 'Submission',
      entityId: smcSourceSubmissionId,
      action: { in: ['SUBMISSION_ENDORSED_FOR_BOARD', 'SUBMISSION_NOT_VETTED_FOR_BOARD'] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!event?.newState) return null;
  try {
    const parsed = JSON.parse(event.newState) as { comment?: string };
    if (!parsed.comment) return null;
    return { comment: parsed.comment, recordedAt: event.createdAt, action: event.action };
  } catch {
    return null;
  }
}

export async function suggestBoardOutcome(submissionId: string): Promise<BoardOutcomeSuggestion> {
  const decisions = await prisma.decision.findMany({ where: { submissionId } });
  return evaluateBoardOutcome(decisions);
}

/** The Corporate Secretariat's manual finalization step — never auto-applied (see
 * approvalRules.ts's module comment on why quorum/majority isn't computed automatically here). */
export async function finalizeBoardOutcome(
  submissionId: string,
  outcome: 'APPROVED' | 'REJECTED' | 'DEFERRED',
  actingUser: AuthenticatedUser,
): Promise<void> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
  if (submission.submissionCategory !== 'BOARD') {
    throw new BoardPaperValidationError('Only a Board Paper can have a Board outcome recorded.');
  }
  if (!isDecisionPaper(submission.paperType)) {
    throw new BoardPaperValidationError('Only Decision Papers require a final Board outcome.');
  }

  await prisma.submission.update({
    where: { id: submissionId },
    data: { boardOutcome: outcome, boardOutcomeAt: new Date(), boardOutcomeById: actingUser.id },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_OUTCOME_FINALIZED',
    entityType: 'Submission',
    entityId: submissionId,
    newState: { boardOutcome: outcome },
    correlationRef: submission.referenceNumber,
  });
}
