import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import type { Delegation } from '@prisma/client';

// CEO -> Director delegation state machine (#A29). Same table-driven-graph, not-a-generic-engine
// approach as src/lib/submissions/workflow.ts, for the same reason: a small fixed graph is easier
// to audit than a rules engine, and this milestone's spec gives an exact state list. OVERDUE is
// deliberately not a stored state — see isOverdue() below.
export const DELEGATION_STATES = [
  'DRAFT',
  'ISSUED',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'AT_RISK',
  'SUBMITTED_FOR_REVIEW',
  'RETURNED_FOR_MORE_WORK',
  'COMPLETED',
  'CLOSED',
  'CANCELLED',
] as const;

export type DelegationState = (typeof DELEGATION_STATES)[number];

const TRANSITIONS: Record<DelegationState, DelegationState[]> = {
  DRAFT: ['ISSUED', 'CANCELLED'],
  ISSUED: ['ACKNOWLEDGED', 'CANCELLED'],
  ACKNOWLEDGED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['AT_RISK', 'SUBMITTED_FOR_REVIEW', 'CANCELLED'],
  AT_RISK: ['IN_PROGRESS', 'SUBMITTED_FOR_REVIEW', 'CANCELLED'],
  SUBMITTED_FOR_REVIEW: ['RETURNED_FOR_MORE_WORK', 'COMPLETED', 'CANCELLED'],
  RETURNED_FOR_MORE_WORK: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
  CANCELLED: [],
};

export class InvalidDelegationTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid delegation transition: ${from} -> ${to}`);
    this.name = 'InvalidDelegationTransitionError';
  }
}

export function isValidDelegationTransition(from: string, to: DelegationState): boolean {
  const allowed = TRANSITIONS[from as DelegationState];
  return Boolean(allowed?.includes(to));
}

// dueDate has passed and the delegation hasn't reached a terminal or already-submitted state —
// computed at read time, not a stored/cron-driven transition into a stored OVERDUE status, same
// "fail open, no scheduler infrastructure" reasoning as Submission.isLate (#A27).
export function isOverdue(delegation: Pick<Delegation, 'dueDate' | 'status'>): boolean {
  const terminal: string[] = ['SUBMITTED_FOR_REVIEW', 'COMPLETED', 'CLOSED', 'CANCELLED'];
  return delegation.dueDate < new Date() && !terminal.includes(delegation.status);
}

/**
 * Applies one state transition: validates it, updates Delegation.status, writes one
 * WorkflowTransition row, and writes one AuditEvent — mirrors transitionSubmission exactly.
 */
export async function transitionDelegation(params: {
  delegation: Delegation;
  toState: DelegationState;
  performedById: string;
  comment?: string;
  extraData?: Record<string, unknown>;
}): Promise<Delegation> {
  const { delegation, toState, performedById, comment, extraData } = params;
  const fromState = delegation.status;

  if (!isValidDelegationTransition(fromState, toState)) {
    throw new InvalidDelegationTransitionError(fromState, toState);
  }

  const updated = await prisma.delegation.update({
    where: { id: delegation.id },
    data: { status: toState, ...extraData },
  });

  await prisma.workflowTransition.create({
    data: {
      entityType: 'Delegation',
      delegationId: delegation.id,
      fromState,
      toState,
      performedById,
      comment,
    },
  });

  await recordAuditEvent({
    userId: performedById,
    action: 'DELEGATION_TRANSITION',
    entityType: 'Delegation',
    entityId: delegation.id,
    previousState: { status: fromState },
    newState: { status: toState },
    correlationRef: delegation.referenceNumber,
  });

  return updated;
}

// A logged note that doesn't change status (progress update, extension request, CEO comment) —
// still a WorkflowTransition row (fromState === toState) so it shows in the same audit timeline as
// real transitions, satisfying "every important action must record... previous state, new state,
// comment" even when the state didn't move.
export async function recordDelegationNote(params: {
  delegation: Delegation;
  performedById: string;
  comment: string;
  action: string;
}): Promise<void> {
  const { delegation, performedById, comment, action } = params;

  await prisma.workflowTransition.create({
    data: {
      entityType: 'Delegation',
      delegationId: delegation.id,
      fromState: delegation.status,
      toState: delegation.status,
      performedById,
      comment,
    },
  });

  await recordAuditEvent({
    userId: performedById,
    action,
    entityType: 'Delegation',
    entityId: delegation.id,
    previousState: { status: delegation.status },
    newState: { status: delegation.status },
    correlationRef: delegation.referenceNumber,
  });
}
