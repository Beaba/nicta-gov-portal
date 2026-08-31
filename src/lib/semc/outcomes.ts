import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole } from '@/lib/auth/rbac';
import { SEMC_SECRETARIAT_ROLES, SEMC_CHAIR_ROLES, SEMC_ANY_ROLES } from '@/lib/semc/roles';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import type { AuthenticatedUser } from '@/lib/auth/types';

export class SemcOutcomeValidationError extends Error {}

// #A32 — the client's exact 8-value SEMC outcome vocabulary. Recorded on the existing `Decision`
// model (reused a third time — SMC/Board registry entries, then Board Member votes since #A30,
// now SEMC formal outcomes — same "free-string decisionType, one append-only row per record"
// shape each time, per the Decision model's own schema comment) rather than a new model.
export const SEMC_OUTCOMES = [
  'Approved',
  'ApprovedWithConditions',
  'Noted',
  'InformationOnly',
  'Returned',
  'Deferred',
  'Rejected',
  'EscalatedToBoard',
] as const;
export type SemcOutcome = (typeof SEMC_OUTCOMES)[number];

export interface RecordSemcOutcomeInput {
  submissionId: string;
  meetingId: string;
  agendaItemId?: string;
  outcome: SemcOutcome;
  decisionWording: string;
  semcComments?: string;
  responsiblePersonId?: string;
  dueDate?: Date;
}

/** Secretariat records the SEMC's collective deliberation outcome for an agenda item — the formal
 * "SEMC Outcomes & Actions" row (Screen 2's outcomes table). */
export async function recordSemcOutcome(input: RecordSemcOutcomeInput, actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, SEMC_SECRETARIAT_ROLES);
  if (!input.decisionWording.trim()) {
    throw new SemcOutcomeValidationError('Enter the decision wording.');
  }

  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: input.submissionId } });

  const decision = await prisma.decision.create({
    data: {
      submissionId: input.submissionId,
      meetingId: input.meetingId,
      decisionType: input.outcome,
      decisionDate: new Date(),
      recordedById: actingUser.id,
      notes: input.decisionWording,
      conditions: input.semcComments,
      submissionVersion: submission.currentVersion,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_OUTCOME_RECORDED',
    entityType: 'Submission',
    entityId: input.submissionId,
    newState: { decisionId: decision.id, outcome: input.outcome },
    correlationRef: submission.referenceNumber,
  });

  if (input.responsiblePersonId && input.dueDate) {
    await prisma.actionItem.create({
      data: {
        submissionId: input.submissionId,
        sourceMeetingId: input.meetingId,
        description: `Action arising from SEMC outcome "${input.outcome}" on ${submission.referenceNumber}: ${input.decisionWording}`,
        ownerId: input.responsiblePersonId,
        dueDate: input.dueDate,
        status: 'NOT_STARTED',
        createdById: actingUser.id,
      },
    });
    await getNotificationProvider().notify({
      userId: input.responsiblePersonId,
      type: 'SEMC_ACTION_ASSIGNED',
      message: `A SEMC action was assigned to you from "${submission.title}".`,
      linkUrl: `/submissions/${input.submissionId}`,
    });
  }

  return decision;
}

/** CEO's final Chairperson comment on an outcome — recorded as a Comment (reused generic model,
 * entityType "Submission") rather than a new field, matching this codebase's existing "CEO
 * comments are logged via the generic comment/audit mechanisms, not a dedicated column"
 * convention (#A27/#A30). */
export async function addChairpersonComment(
  submissionId: string,
  actingUser: AuthenticatedUser,
  body: string,
): Promise<void> {
  requireAnyRole(actingUser, SEMC_CHAIR_ROLES);
  if (!body.trim()) throw new SemcOutcomeValidationError('Enter a comment.');
  const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });

  await prisma.comment.create({
    data: { entityType: 'Submission', entityId: submissionId, authorId: actingUser.id, body },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_CHAIRPERSON_COMMENT_ADDED',
    entityType: 'Submission',
    entityId: submissionId,
    newState: { body },
    correlationRef: submission.referenceNumber,
  });
}

export async function listSemcOutcomesForUser(actingUser: AuthenticatedUser, meetingId?: string) {
  requireAnyRole(actingUser, SEMC_ANY_ROLES);
  return prisma.decision.findMany({
    where: {
      decisionType: { in: [...SEMC_OUTCOMES] },
      ...(meetingId ? { meetingId } : {}),
    },
    include: { submission: { include: { department: true } } },
    orderBy: { decisionDate: 'desc' },
  });
}
