import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import type { Submission } from '@prisma/client';

// Milestone 1 submission state machine — see docs/milestone-1-plan.md. Deliberately a small
// table-driven graph, not a generic workflow engine, per the client's explicit instruction not to
// introduce one for this milestone. Permission checks (who may perform which transition) live in
// the calling action functions (src/lib/submissions/submissions.ts, review.ts), not here — this
// module only owns "is this transition legal" and "record it."
export const SUBMISSION_STATES = [
  'DRAFT',
  'SUBMITTED',
  'AI_REVIEWED',
  'SECRETARIAT_REVIEW',
  'RETURNED',
  'ACCEPTED',
  'ROUTED',
  'CLOSED',
] as const;

export type SubmissionState = (typeof SUBMISSION_STATES)[number];

const TRANSITIONS: Record<SubmissionState, SubmissionState[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['AI_REVIEWED'],
  AI_REVIEWED: ['SECRETARIAT_REVIEW'],
  SECRETARIAT_REVIEW: ['RETURNED', 'ACCEPTED'],
  RETURNED: ['SUBMITTED'],
  ACCEPTED: ['ROUTED'],
  ROUTED: ['CLOSED'],
  CLOSED: [],
};

export class InvalidTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid submission transition: ${from} -> ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

export function isValidTransition(from: string, to: SubmissionState): boolean {
  const allowed = TRANSITIONS[from as SubmissionState];
  return Boolean(allowed?.includes(to));
}

/**
 * Applies one state transition: validates it against the graph above, updates
 * Submission.workflowStatus, writes one WorkflowTransition row, and writes one AuditEvent — the
 * three things the client requires every transition to record (previous status, new status, user,
 * timestamp, comment, submission version).
 */
export async function transitionSubmission(params: {
  submission: Submission;
  toState: SubmissionState;
  performedById: string;
  comment?: string;
}): Promise<Submission> {
  const { submission, toState, performedById, comment } = params;
  const fromState = submission.workflowStatus;

  if (!isValidTransition(fromState, toState)) {
    throw new InvalidTransitionError(fromState, toState);
  }

  const updated = await prisma.submission.update({
    where: { id: submission.id },
    data: { workflowStatus: toState },
  });

  await prisma.workflowTransition.create({
    data: {
      entityType: 'Submission',
      submissionId: submission.id,
      fromState,
      toState,
      performedById,
      comment,
    },
  });

  await recordAuditEvent({
    userId: performedById,
    action: 'SUBMISSION_TRANSITION',
    entityType: 'Submission',
    entityId: submission.id,
    previousState: { workflowStatus: fromState, version: submission.currentVersion },
    newState: { workflowStatus: toState, version: updated.currentVersion },
    correlationRef: submission.referenceNumber,
  });

  return updated;
}
