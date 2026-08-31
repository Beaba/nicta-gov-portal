import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  createDelegation,
  issueDelegation,
  acknowledgeDelegation,
  startDelegationWork,
  submitDelegationForReview,
  nominateDelegationAlternate,
  assignDelegationToManager,
  DelegationValidationError,
} from '@/lib/delegations/delegations';

// #A32 — Delegation extensions: category, multi-recipient addressing (a Manager notified while
// the Director stays accountable lead), Nominate Alternate / Assign to Manager Director actions,
// and the completion-requirement enforcement gap found in
// docs/ceo-portal-requirements-review.md (DEL-3/DEL-4).

let ceo: AuthenticatedUser;
let director: AuthenticatedUser;
let manager: AuthenticatedUser;
const createdDelegationIds: string[] = [];

async function requireUserByEmail(email: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const loaded = await loadAuthenticatedUser(user.id);
  if (!loaded) throw new Error(`Could not load ${email}`);
  return loaded;
}

beforeAll(async () => {
  [ceo, director, manager] = await Promise.all([
    requireUserByEmail('ceo.demo@nicta.gov.pg'),
    requireUserByEmail('rasari@nicta.gov.pg'),
    requireUserByEmail('manager1.digital_transformation.demo@nicta.gov.pg'),
  ]);
});

afterAll(async () => {
  if (createdDelegationIds.length) {
    await prisma.workflowTransition.deleteMany({ where: { delegationId: { in: createdDelegationIds } } });
    await prisma.auditEvent.deleteMany({ where: { entityType: 'Delegation', entityId: { in: createdDelegationIds } } });
    await prisma.delegationRecipient.deleteMany({ where: { delegationId: { in: createdDelegationIds } } });
    await prisma.delegation.deleteMany({ where: { id: { in: createdDelegationIds } } });
  }
});

async function createTestDelegation(overrides: Partial<Parameters<typeof createDelegation>[0]> = {}) {
  const delegation = await createDelegation(
    {
      title: `TEST-A32 Delegation ${Date.now()}-${Math.random()}`,
      description: 'Regression test delegation.',
      responsibleDirectorId: director.id,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      expectedOutcome: 'Test outcome.',
      category: 'Task',
      ...overrides,
    },
    ceo,
  );
  createdDelegationIds.push(delegation.id);
  return delegation;
}

describe('Delegations — category and multi-recipient addressing', () => {
  it('stores the category', async () => {
    const delegation = await createTestDelegation({ category: 'Document Review' });
    expect(delegation.category).toBe('Document Review');
  });

  it('a Manager passed as an additional recipient is recorded, with the Director staying accountable lead', async () => {
    const delegation = await createTestDelegation({ additionalRecipientUserIds: [manager.id] });
    const recipients = await prisma.delegationRecipient.findMany({ where: { delegationId: delegation.id } });
    expect(recipients.some((r) => r.userId === manager.id)).toBe(true);
    expect(delegation.responsibleDirectorId).toBe(director.id);
  });
});

describe('Delegations — Nominate Alternate / Assign to Manager', () => {
  let delegationId: string;

  beforeAll(async () => {
    const delegation = await createTestDelegation();
    delegationId = delegation.id;
    await issueDelegation(delegationId, ceo);
    await acknowledgeDelegation(delegationId, director);
    await startDelegationWork(delegationId, director);
  });

  it('the Director can nominate an alternate, recorded on the transition timeline', async () => {
    await nominateDelegationAlternate(delegationId, director, manager.id, 'I am unavailable this week.');
    const transitions = await prisma.workflowTransition.findMany({
      where: { delegationId, comment: { contains: 'Nominated' } },
    });
    expect(transitions.length).toBeGreaterThan(0);
  });

  it('the Director can assign the delegation to a Manager without losing accountable-lead status', async () => {
    await assignDelegationToManager(delegationId, director, manager.id);
    const recipients = await prisma.delegationRecipient.findMany({ where: { delegationId } });
    expect(recipients.some((r) => r.userId === manager.id && r.recipientRole === 'MANAGER')).toBe(true);
    const delegation = await prisma.delegation.findUniqueOrThrow({ where: { id: delegationId } });
    expect(delegation.responsibleDirectorId).toBe(director.id);
  });
});

describe('Delegations — completion requires evidence or a report', () => {
  let delegationId: string;

  beforeAll(async () => {
    const delegation = await createTestDelegation({ completionRequirement: 'EVIDENCE' });
    delegationId = delegation.id;
    await issueDelegation(delegationId, ceo);
    await acknowledgeDelegation(delegationId, director);
    await startDelegationWork(delegationId, director);
  });

  it('submitting for review with no evidence and no comment is rejected', async () => {
    await expect(submitDelegationForReview(delegationId, director)).rejects.toThrow(
      DelegationValidationError,
    );
  });

  it('submitting with a comment satisfies the requirement', async () => {
    const updated = await submitDelegationForReview(delegationId, director, 'Completed with a written report.');
    expect(updated.status).toBe('SUBMITTED_FOR_REVIEW');
  });
});

describe('Delegations — Acknowledgement Only skips the evidence requirement', () => {
  it('allows submission with no comment when completionRequirement is ACKNOWLEDGEMENT_ONLY', async () => {
    const delegation = await createTestDelegation({ completionRequirement: 'ACKNOWLEDGEMENT_ONLY' });
    await issueDelegation(delegation.id, ceo);
    await acknowledgeDelegation(delegation.id, director);
    await startDelegationWork(delegation.id, director);
    const updated = await submitDelegationForReview(delegation.id, director);
    expect(updated.status).toBe('SUBMITTED_FOR_REVIEW');
  });
});
