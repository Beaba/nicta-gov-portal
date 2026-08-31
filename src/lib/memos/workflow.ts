import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import type { Memo } from '@prisma/client';

// The client's exact 12-value Memo status vocabulary — same table-driven-graph pattern as every
// other workflow module in this codebase.
export const MEMO_STATES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'AWAITING_SUPPORTING_REVIEW',
  'AWAITING_CEO_APPROVAL',
  'RETURNED',
  'APPROVED',
  'APPROVED_WITH_CONDITIONS',
  'REJECTED',
  'WITHDRAWN',
  'COMPLETED',
  'ARCHIVED',
] as const;
export type MemoState = (typeof MEMO_STATES)[number];

const TRANSITIONS: Record<MemoState, MemoState[]> = {
  DRAFT: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['UNDER_REVIEW', 'WITHDRAWN'],
  UNDER_REVIEW: ['AWAITING_SUPPORTING_REVIEW', 'AWAITING_CEO_APPROVAL', 'WITHDRAWN'],
  AWAITING_SUPPORTING_REVIEW: ['AWAITING_CEO_APPROVAL', 'WITHDRAWN'],
  AWAITING_CEO_APPROVAL: ['RETURNED', 'APPROVED', 'APPROVED_WITH_CONDITIONS', 'REJECTED'],
  RETURNED: ['SUBMITTED', 'WITHDRAWN'],
  APPROVED: ['COMPLETED'],
  APPROVED_WITH_CONDITIONS: ['COMPLETED'],
  REJECTED: [],
  WITHDRAWN: [],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
};

export class InvalidMemoTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid memo transition: ${from} -> ${to}`);
    this.name = 'InvalidMemoTransitionError';
  }
}

export function isValidMemoTransition(from: string, to: MemoState): boolean {
  return Boolean(TRANSITIONS[from as MemoState]?.includes(to));
}

export async function transitionMemo(params: {
  memo: Memo;
  toState: MemoState;
  performedById: string;
  comment?: string;
}): Promise<Memo> {
  const { memo, toState, performedById, comment } = params;
  const fromState = memo.status as MemoState;
  if (!isValidMemoTransition(fromState, toState)) {
    throw new InvalidMemoTransitionError(fromState, toState);
  }

  const updated = await prisma.memo.update({ where: { id: memo.id }, data: { status: toState } });

  await prisma.workflowTransition.create({
    data: { entityType: 'Memo', memoId: memo.id, fromState, toState, performedById, comment },
  });

  await recordAuditEvent({
    userId: performedById,
    action: 'MEMO_TRANSITION',
    entityType: 'Memo',
    entityId: memo.id,
    previousState: { status: fromState },
    newState: { status: toState },
    correlationRef: memo.referenceNumber,
  });

  return updated;
}
