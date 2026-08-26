import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';

import { listCriticalTasks } from '@/lib/executive/criticalTasks';
import { listCeoApprovalInbox } from '@/lib/executive/approvalInbox';
import { getSubmissionForUser } from '@/lib/submissions/submissions';
import { createBoardMeeting, publishBoardMeeting } from '@/lib/board/meetings';

// #A31 — permissions and the CEO Approval Inbox aggregation, plus a regression test for the real
// access-control gap found and fixed live during this pass (Board Secretariat previously had no
// read path to a Board Paper at all).

let ceo: AuthenticatedUser;
let director: AuthenticatedUser;
let boardSecretariat: AuthenticatedUser;
let boardMember: AuthenticatedUser;
let departmentId: string;
let meetingId: string;
let boardPaperId: string;

async function requireUserByEmail(email: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const loaded = await loadAuthenticatedUser(user.id);
  if (!loaded) throw new Error(`Could not load ${email}`);
  return loaded;
}

beforeAll(async () => {
  [ceo, director, boardSecretariat, boardMember] = await Promise.all([
    requireUserByEmail('ceo.demo@nicta.gov.pg'),
    requireUserByEmail('rasari@nicta.gov.pg'),
    requireUserByEmail('board.secretariat.demo@nicta.gov.pg'),
    requireUserByEmail('board.member1.demo@nicta.gov.pg'),
  ]);
  const dept = await prisma.department.findFirstOrThrow({ where: { isActive: true } });
  departmentId = dept.id;

  const meeting = await createBoardMeeting(
    { title: 'TEST-A31-Meeting', meetingDate: new Date() },
    boardSecretariat,
  );
  await publishBoardMeeting(meeting.id, boardSecretariat);
  meetingId = meeting.id;

  const paper = await prisma.submission.create({
    data: {
      referenceNumber: `TEST-A31-BP-${Date.now()}`,
      submissionCategory: 'BOARD',
      // listCeoApprovalInbox's Board-paper branch only surfaces Decision Papers (see
      // approvalInbox.ts's isDecisionPaper filter) — Information/Discussion Papers don't need a
      // CEO decision, only a Board one.
      paperType: 'Decision Paper',
      title: 'TEST-A31 Board Paper',
      departmentId,
      createdById: director.id,
      meetingId,
      workflowStatus: 'SUBMITTED',
    },
  });
  boardPaperId = paper.id;
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { entityType: 'Submission', entityId: boardPaperId },
        { entityType: 'Meeting', entityId: meetingId },
      ],
    },
  });
  await prisma.submission.deleteMany({ where: { id: boardPaperId } });
  await prisma.meeting.deleteMany({ where: { id: meetingId } });
});

describe('Executive Dashboard — permissions', () => {
  it('a non-CEO role cannot list critical tasks', async () => {
    await expect(listCriticalTasks(director)).rejects.toThrow(AuthorizationError);
  });

  it('a non-CEO role cannot list the CEO approval inbox', async () => {
    await expect(listCeoApprovalInbox(director)).rejects.toThrow(AuthorizationError);
  });

  it('the CEO can list both without error', async () => {
    await expect(listCriticalTasks(ceo)).resolves.toBeInstanceOf(Array);
    await expect(listCeoApprovalInbox(ceo)).resolves.toBeInstanceOf(Array);
  });
});

describe('Executive Dashboard — CEO Approval Inbox aggregation', () => {
  it('includes a Board Paper with no boardOutcome recorded yet', async () => {
    const inbox = await listCeoApprovalInbox(ceo);
    expect(inbox.some((item) => item.id === boardPaperId)).toBe(true);
  });
});

describe('#A31 regression — Board Secretariat document/submission access', () => {
  it('Board Secretariat can view a Board Paper (previously threw AuthorizationError)', async () => {
    const submission = await getSubmissionForUser(boardPaperId, boardSecretariat);
    expect(submission.id).toBe(boardPaperId);
  });

  it('the CEO can also view the Board Paper', async () => {
    const submission = await getSubmissionForUser(boardPaperId, ceo);
    expect(submission.id).toBe(boardPaperId);
  });

  it('a Board Member can view the Board Paper once its meeting is published', async () => {
    const submission = await getSubmissionForUser(boardPaperId, boardMember);
    expect(submission.id).toBe(boardPaperId);
  });

  it('an unrelated Director cannot view a Board Paper that is not theirs', async () => {
    const otherDirector = await requireUserByEmail('sanda@nicta.gov.pg');
    await expect(getSubmissionForUser(boardPaperId, otherDirector)).rejects.toThrow(
      AuthorizationError,
    );
  });
});
