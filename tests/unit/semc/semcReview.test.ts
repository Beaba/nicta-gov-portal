import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  acceptForSemcAgenda,
  returnSemcSubmissionToDirector,
  recommendBoardEscalation,
  SemcReviewValidationError,
} from '@/lib/submissions/semcReview';
import { markEndorsedForBoard } from '@/lib/submissions/review';

// #A32 — the CEO's real, distinct pre-meeting SEMC actions (resolving the requirements review's
// SEMC-7 finding: these 6 verbs previously either didn't exist or were Secretariat-gated) and the
// two-step "SEMC recommends, CEO confirms" Board escalation model.

let ceo: AuthenticatedUser;
let secretariat: AuthenticatedUser;
let director: AuthenticatedUser;
let departmentId: string;
let submissionId: string;

async function requireUserByEmail(email: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const loaded = await loadAuthenticatedUser(user.id);
  if (!loaded) throw new Error(`Could not load ${email}`);
  return loaded;
}

beforeAll(async () => {
  [ceo, secretariat, director] = await Promise.all([
    requireUserByEmail('ceo.demo@nicta.gov.pg'),
    requireUserByEmail('ltol@nicta.gov.pg'),
    requireUserByEmail('rasari@nicta.gov.pg'),
  ]);
  departmentId = director.departmentId!;

  const submission = await prisma.submission.create({
    data: {
      referenceNumber: `TEST-A32-SEMC-${Date.now()}`,
      submissionCategory: 'SMC',
      paperType: 'SMC Information Paper',
      title: 'TEST-A32 SEMC Report',
      departmentId,
      createdById: director.id,
      workflowStatus: 'ACCEPTED',
    },
  });
  submissionId = submission.id;
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { entityType: 'Submission', entityId: submissionId } });
  await prisma.comment.deleteMany({ where: { entityType: 'Submission', entityId: submissionId } });
  await prisma.submission.deleteMany({ where: { id: submissionId } });
});

describe('SEMC pre-meeting review — permissions', () => {
  it('the Corporate Secretariat cannot accept a report for the SEMC agenda (that is the CEO\'s action)', async () => {
    await expect(acceptForSemcAgenda(submissionId, secretariat)).rejects.toThrow(AuthorizationError);
  });

  it('the CEO can accept a vetted report for the agenda', async () => {
    const updated = await acceptForSemcAgenda(submissionId, ceo, 'Ready for SEMC.');
    expect(updated.ceoAgendaStatus).toBe('ACCEPTED_FOR_AGENDA');
    expect(updated.ceoAgendaStatusById).toBe(ceo.id);
  });

  it('returning to the Director requires a comment', async () => {
    await expect(returnSemcSubmissionToDirector(submissionId, ceo, '')).rejects.toThrow(
      SemcReviewValidationError,
    );
    const updated = await returnSemcSubmissionToDirector(submissionId, ceo, 'Needs more detail.');
    expect(updated.ceoAgendaStatus).toBe('RETURNED');
  });
});

describe('Board escalation — two-step SEMC-recommends/CEO-confirms model', () => {
  it('the Corporate Secretariat records the SEMC recommendation', async () => {
    await recommendBoardEscalation(submissionId, secretariat, 'Material financial exposure.');
    const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(submission.semcEscalationRecommended).toBe(true);
    expect(submission.endorsedForBoard).toBe(false);
  });

  it('a Director cannot confirm the escalation', async () => {
    await expect(markEndorsedForBoard(submissionId, director, 'attempt')).rejects.toThrow(
      AuthorizationError,
    );
  });

  it('the CEO confirms escalation via the existing endorsedForBoard mechanism', async () => {
    await markEndorsedForBoard(submissionId, ceo, 'Confirmed for Board escalation.');
    const submission = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } });
    expect(submission.semcEscalationRecommended).toBe(true);
    expect(submission.endorsedForBoard).toBe(true);
  });
});
