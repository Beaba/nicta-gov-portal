import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  createMemo,
  submitMemo,
  approveMemo,
  rejectMemo,
  delegateMemoReview,
  MemoValidationError,
} from '@/lib/memos/memos';

// #A32 — regression coverage for a real bug caught live: submitMemo originally tried an invalid
// SUBMITTED -> AWAITING_CEO_APPROVAL transition directly (MEMO_STATES/workflow.ts only allows
// SUBMITTED -> UNDER_REVIEW), which threw and silently stranded every memo — a plain BAU memo with
// no financial value never reached the CEO's queue at all. Fixed by chaining through UNDER_REVIEW.
// These tests would have failed against the original code.

let ceo: AuthenticatedUser;
let director: AuthenticatedUser;
let ceoOffice: AuthenticatedUser;
let departmentId: string;
const createdMemoIds: string[] = [];

async function requireUserByEmail(email: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const loaded = await loadAuthenticatedUser(user.id);
  if (!loaded) throw new Error(`Could not load ${email}`);
  return loaded;
}

beforeAll(async () => {
  [ceo, director, ceoOffice] = await Promise.all([
    requireUserByEmail('ceo.demo@nicta.gov.pg'),
    requireUserByEmail('rasari@nicta.gov.pg'),
    requireUserByEmail('ceo.office.demo@nicta.gov.pg'),
  ]);
  departmentId = director.departmentId!;
});

afterAll(async () => {
  if (createdMemoIds.length) {
    await prisma.workflowTransition.deleteMany({ where: { memoId: { in: createdMemoIds } } });
    await prisma.auditEvent.deleteMany({ where: { entityType: 'Memo', entityId: { in: createdMemoIds } } });
    await prisma.comment.deleteMany({ where: { entityType: 'Memo', entityId: { in: createdMemoIds } } });
    await prisma.memo.deleteMany({ where: { id: { in: createdMemoIds } } });
  }
});

async function createTestMemo(financialValue?: number) {
  const memo = await createMemo(
    {
      category: 'General BAU Approval',
      subject: `TEST-A32 Memo ${Date.now()}-${Math.random()}`,
      departmentId,
      purpose: 'Regression test memo.',
      requestedDecision: 'Approve as recommended.',
      financialValue,
    },
    director,
  );
  createdMemoIds.push(memo.id);
  return memo;
}

describe('Memos — submit workflow reaches the CEO (regression)', () => {
  it('a plain BAU memo with no financial value reaches AWAITING_CEO_APPROVAL after submit', async () => {
    const memo = await createTestMemo();
    const submitted = await submitMemo(memo.id, director);
    expect(submitted.status).toBe('AWAITING_CEO_APPROVAL');
  });

  it('a financial memo also reaches AWAITING_CEO_APPROVAL after submit', async () => {
    const memo = await createTestMemo(85000);
    const submitted = await submitMemo(memo.id, director);
    expect(submitted.status).toBe('AWAITING_CEO_APPROVAL');
  });

  it('every transition is recorded on the WorkflowTransition timeline', async () => {
    const memo = await createTestMemo();
    await submitMemo(memo.id, director);
    const transitions = await prisma.workflowTransition.findMany({ where: { memoId: memo.id } });
    const toStates = transitions.map((t) => t.toState);
    expect(toStates).toContain('SUBMITTED');
    expect(toStates).toContain('AWAITING_CEO_APPROVAL');
  });
});

describe('Memos — CEO decision permissions', () => {
  it('a Director cannot approve a memo', async () => {
    const memo = await createTestMemo();
    await submitMemo(memo.id, director);
    await expect(approveMemo(memo.id, director)).rejects.toThrow(AuthorizationError);
  });

  it('CEO Office (EO/PA) cannot approve or reject a memo', async () => {
    const memo = await createTestMemo();
    await submitMemo(memo.id, director);
    await expect(approveMemo(memo.id, ceoOffice)).rejects.toThrow(AuthorizationError);
    await expect(rejectMemo(memo.id, ceoOffice, 'no')).rejects.toThrow(AuthorizationError);
  });

  it('the CEO can approve', async () => {
    const memo = await createTestMemo();
    await submitMemo(memo.id, director);
    const approved = await approveMemo(memo.id, ceo);
    expect(approved.status).toBe('APPROVED');
  });

  it('reject requires a comment', async () => {
    const memo = await createTestMemo();
    await submitMemo(memo.id, director);
    await expect(rejectMemo(memo.id, ceo, '')).rejects.toThrow(MemoValidationError);
    const rejected = await rejectMemo(memo.id, ceo, 'Not aligned with priorities.');
    expect(rejected.status).toBe('REJECTED');
  });
});

describe('Memos — Delegate Review grants visibility, not approval authority', () => {
  it('delegating review lets CEO Office see the memo but still not approve it', async () => {
    const memo = await createTestMemo();
    await submitMemo(memo.id, director);
    await delegateMemoReview(memo.id, ceo, ceoOffice.id);

    const { getMemoForUser } = await import('@/lib/memos/memos');
    const visible = await getMemoForUser(memo.id, ceoOffice);
    expect(visible?.delegatedReviewerId).toBe(ceoOffice.id);

    await expect(approveMemo(memo.id, ceoOffice)).rejects.toThrow(AuthorizationError);
  });
});
