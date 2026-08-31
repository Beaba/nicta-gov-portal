import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  createMilestone,
  submitMilestoneProgress,
  validateMilestone,
  returnMilestoneForClarification,
  changeMilestoneTarget,
  MilestoneValidationError,
} from '@/lib/performance/milestones';

// #A32 — CEO milestone monitoring: creation, Director progress submission (must not silently
// become official), CEO validation/return, and the approved-target-change audit requirement.

let ceo: AuthenticatedUser;
let director: AuthenticatedUser;
let otherDirector: AuthenticatedUser;
let departmentId: string;
let milestoneId: string;

async function requireUserByEmail(email: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const loaded = await loadAuthenticatedUser(user.id);
  if (!loaded) throw new Error(`Could not load ${email}`);
  return loaded;
}

beforeAll(async () => {
  [ceo, director, otherDirector] = await Promise.all([
    requireUserByEmail('ceo.demo@nicta.gov.pg'),
    requireUserByEmail('rasari@nicta.gov.pg'),
    requireUserByEmail('sanda@nicta.gov.pg'),
  ]);
  departmentId = director.departmentId!;
});

afterAll(async () => {
  if (milestoneId) {
    await prisma.auditEvent.deleteMany({ where: { entityType: 'Milestone', entityId: milestoneId } });
    await prisma.milestone.deleteMany({ where: { id: milestoneId } });
  }
});

describe('Milestones — permissions', () => {
  it('a Director cannot create a milestone', async () => {
    await expect(
      createMilestone(
        {
          title: 'TEST-A32 Milestone',
          departmentId,
          responsibleDirectorId: director.id,
          targetDescription: 'Test target',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        director,
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it('the CEO can create a milestone', async () => {
    const m = await createMilestone(
      {
        title: 'TEST-A32 Milestone',
        departmentId,
        responsibleDirectorId: director.id,
        targetDescription: 'Test target',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      ceo,
    );
    milestoneId = m.id;
    expect(m.validationStatus).toBe('SUBMITTED');
  });
});

describe('Milestones — Director progress does not silently become official', () => {
  it('an unrelated Director cannot submit progress on this milestone', async () => {
    await expect(
      submitMilestoneProgress(milestoneId, otherDirector, { progressPercent: 50 }),
    ).rejects.toThrow(MilestoneValidationError);
  });

  it('the responsible Director submitting progress lands on AWAITING_CEO_VALIDATION, not VALIDATED', async () => {
    const updated = await submitMilestoneProgress(milestoneId, director, {
      progressPercent: 40,
      directorComment: 'Progress update.',
    });
    expect(updated.validationStatus).toBe('AWAITING_CEO_VALIDATION');
    expect(updated.progressPercent).toBe(40);
  });

  it('a Director cannot validate their own milestone', async () => {
    await expect(validateMilestone(milestoneId, director)).rejects.toThrow(AuthorizationError);
  });

  it('the CEO can validate', async () => {
    const updated = await validateMilestone(milestoneId, ceo, 'Looks good.');
    expect(updated.validationStatus).toBe('VALIDATED');
  });

  it('the CEO can return a later update for clarification, requiring a comment', async () => {
    await submitMilestoneProgress(milestoneId, director, { progressPercent: 60 });
    await expect(returnMilestoneForClarification(milestoneId, ceo, '')).rejects.toThrow(
      MilestoneValidationError,
    );
    const updated = await returnMilestoneForClarification(milestoneId, ceo, 'Explain the delay.');
    expect(updated.validationStatus).toBe('RETURNED_FOR_CLARIFICATION');
  });
});

describe('Milestones — approved target changes are audited', () => {
  it('requires a reason', async () => {
    await expect(
      changeMilestoneTarget(milestoneId, ceo, { targetDescription: 'New target' }, ''),
    ).rejects.toThrow(MilestoneValidationError);
  });

  it('records previous value, new value, reason, user and timestamp in the audit log', async () => {
    const before = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
    await changeMilestoneTarget(
      milestoneId,
      ceo,
      { targetDescription: 'Revised target description' },
      'Scope changed after Board direction.',
    );

    const event = await prisma.auditEvent.findFirst({
      where: { entityType: 'Milestone', entityId: milestoneId, action: 'MILESTONE_TARGET_CHANGED' },
      orderBy: { createdAt: 'desc' },
    });
    expect(event).not.toBeNull();
    expect(event!.userId).toBe(ceo.id);
    const previous = JSON.parse(event!.previousState!);
    const next = JSON.parse(event!.newState!);
    expect(previous.targetDescription).toBe(before.targetDescription);
    expect(next.targetDescription).toBe('Revised target description');
    expect(next.reason).toBe('Scope changed after Board direction.');
  });
});
