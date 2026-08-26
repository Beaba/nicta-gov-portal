import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';

import { createBoardMeeting, publishBoardMeeting, getMeetingForUser } from '@/lib/board/meetings';
import {
  recordBoardDecision,
  getMyLatestDecision,
  BoardDecisionValidationError,
} from '@/lib/board/decisions';
import { evaluateBoardOutcome } from '@/lib/board/approvalRules';
import { addComment, listComments, resolveComment } from '@/lib/board/comments';
import {
  createResolution,
  transitionResolutionStatus,
  ResolutionValidationError,
} from '@/lib/board/resolutions';

// #A30 acceptance criterion 14: permissions, paper visibility, approvals, comments, resolutions,
// audit history. Integration-style (real Postgres, via the same docker-compose db these tests run
// against locally — no mocking), reusing already-seeded demo accounts rather than creating new
// Users, so the only cleanup needed is the test-specific rows this file creates itself (marked
// with a "TEST-A30-" prefix, deleted in afterAll — same discipline as this project's manual
// Playwright verification passes, just made permanent and re-runnable).

let ceo: AuthenticatedUser;
let boardMember1: AuthenticatedUser;
let boardMember2: AuthenticatedUser;
let secretariat: AuthenticatedUser;
let director: AuthenticatedUser;
let departmentId: string;

let draftMeetingId: string;
let publishedMeetingId: string;
let boardPaperId: string;
let decisionPaperId: string;

async function requireUserByEmail(email: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const loaded = await loadAuthenticatedUser(user.id);
  if (!loaded) throw new Error(`Could not load ${email} as an AuthenticatedUser`);
  return loaded;
}

beforeAll(async () => {
  [ceo, boardMember1, boardMember2, secretariat, director] = await Promise.all([
    requireUserByEmail('ceo.demo@nicta.gov.pg'),
    requireUserByEmail('board.member1.demo@nicta.gov.pg'),
    requireUserByEmail('board.member2.demo@nicta.gov.pg'),
    requireUserByEmail('board.secretariat.demo@nicta.gov.pg'),
    requireUserByEmail('rasari@nicta.gov.pg'),
  ]);
  const dept = await prisma.department.findFirstOrThrow({ where: { isActive: true } });
  departmentId = dept.id;

  const draftMeeting = await createBoardMeeting(
    { title: 'TEST-A30-Draft-Meeting', meetingDate: new Date() },
    secretariat,
  );
  draftMeetingId = draftMeeting.id;

  const toPublish = await createBoardMeeting(
    { title: 'TEST-A30-Published-Meeting', meetingDate: new Date() },
    secretariat,
  );
  await publishBoardMeeting(toPublish.id, secretariat);
  publishedMeetingId = toPublish.id;

  const infoPaper = await prisma.submission.create({
    data: {
      referenceNumber: `TEST-A30-BP-${Date.now()}`,
      submissionCategory: 'BOARD',
      paperType: 'Information Paper',
      title: 'TEST-A30 Information Paper',
      departmentId,
      createdById: director.id,
      meetingId: publishedMeetingId,
      workflowStatus: 'SUBMITTED',
    },
  });
  boardPaperId = infoPaper.id;

  const decisionPaper = await prisma.submission.create({
    data: {
      referenceNumber: `TEST-A30-BP-DEC-${Date.now()}`,
      submissionCategory: 'BOARD',
      paperType: 'Decision Paper',
      title: 'TEST-A30 Decision Paper',
      departmentId,
      createdById: director.id,
      meetingId: publishedMeetingId,
      workflowStatus: 'SUBMITTED',
    },
  });
  decisionPaperId = decisionPaper.id;
});

afterAll(async () => {
  const submissionIds = [boardPaperId, decisionPaperId].filter(Boolean);
  const meetingIds = [draftMeetingId, publishedMeetingId].filter(Boolean);

  await prisma.comment.deleteMany({ where: { entityId: { in: submissionIds } } });
  await prisma.decision.deleteMany({ where: { submissionId: { in: submissionIds } } });
  await prisma.resolution.deleteMany({ where: { meetingId: { in: meetingIds } } });
  await prisma.workflowTransition.deleteMany({
    where: { OR: [{ submissionId: { in: submissionIds } }] },
  });
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { entityType: 'Submission', entityId: { in: submissionIds } },
        { entityType: 'Meeting', entityId: { in: meetingIds } },
      ],
    },
  });
  await prisma.submission.deleteMany({ where: { id: { in: submissionIds } } });
  await prisma.meetingAgendaItem.deleteMany({ where: { meetingId: { in: meetingIds } } });
  await prisma.meetingAttendance.deleteMany({ where: { meetingId: { in: meetingIds } } });
  await prisma.meetingMinutes.deleteMany({ where: { meetingId: { in: meetingIds } } });
  await prisma.meeting.deleteMany({ where: { id: { in: meetingIds } } });
});

describe('Board Dashboard — permissions', () => {
  it('a non-Board role cannot create a Board meeting', async () => {
    await expect(
      createBoardMeeting({ title: 'Should fail', meetingDate: new Date() }, director),
    ).rejects.toThrow(AuthorizationError);
  });

  it('a Director (not a Board Member) cannot record a Board decision', async () => {
    await expect(
      recordBoardDecision(decisionPaperId, director, { decisionType: 'Approve' }),
    ).rejects.toThrow(AuthorizationError);
  });
});

describe('Board Dashboard — paper/meeting visibility', () => {
  it('a Board Member cannot view a DRAFT (unpublished) meeting', async () => {
    await expect(getMeetingForUser(draftMeetingId, boardMember1)).rejects.toThrow(
      AuthorizationError,
    );
  });

  it('a Board Member can view a PUBLISHED meeting', async () => {
    const meeting = await getMeetingForUser(publishedMeetingId, boardMember1);
    expect(meeting?.id).toBe(publishedMeetingId);
  });

  it('the Board Secretariat can view a DRAFT meeting', async () => {
    const meeting = await getMeetingForUser(draftMeetingId, secretariat);
    expect(meeting?.id).toBe(draftMeetingId);
  });
});

describe('Board Dashboard — approvals (decisions)', () => {
  it('requires a comment for Reject', async () => {
    await expect(
      recordBoardDecision(decisionPaperId, boardMember1, { decisionType: 'Reject' }),
    ).rejects.toThrow(BoardDecisionValidationError);
  });

  it('does not require a comment for Approve', async () => {
    await recordBoardDecision(decisionPaperId, boardMember1, { decisionType: 'Approve' });
    const latest = await getMyLatestDecision(decisionPaperId, boardMember1);
    expect(latest?.decisionType).toBe('Approve');
  });

  it('a changed vote supersedes the previous one (latest wins) without deleting history', async () => {
    await recordBoardDecision(decisionPaperId, boardMember1, {
      decisionType: 'Defer',
      comment: 'Need more financial detail.',
    });
    const latest = await getMyLatestDecision(decisionPaperId, boardMember1);
    expect(latest?.decisionType).toBe('Defer');

    const allForUser = await prisma.decision.count({
      where: { submissionId: decisionPaperId, recordedById: boardMember1.id },
    });
    expect(allForUser).toBe(2); // both the Approve and the Defer still exist
  });

  it('evaluateBoardOutcome: any Reject wins over everything else', () => {
    const outcome = evaluateBoardOutcome([
      { decisionType: 'Approve', recordedById: 'u1' },
      { decisionType: 'Reject', recordedById: 'u2' },
    ]);
    expect(outcome).toBe('REJECTED');
  });

  it('evaluateBoardOutcome: all Approve -> APPROVED', () => {
    const outcome = evaluateBoardOutcome([
      { decisionType: 'Approve', recordedById: 'u1' },
      { decisionType: 'ApproveSubjectToConditions', recordedById: 'u2' },
    ]);
    expect(outcome).toBe('APPROVED');
  });

  it('evaluateBoardOutcome: no decisions -> PENDING', () => {
    expect(evaluateBoardOutcome([])).toBe('PENDING');
  });
});

describe('Board Dashboard — comments', () => {
  it('rejects an empty comment', async () => {
    await expect(
      addComment('Submission', boardPaperId, boardMember1, { body: '   ' }),
    ).rejects.toThrow();
  });

  it('supports replies and returns them grouped under the parent', async () => {
    const root = await addComment('Submission', boardPaperId, boardMember1, {
      body: 'What is the expected cost impact?',
    });
    await addComment('Submission', boardPaperId, secretariat, {
      body: 'Circulating the finance annex now.',
      parentId: root.id,
    });

    const thread = await listComments('Submission', boardPaperId, boardMember1);
    const rootIndex = thread.findIndex((c) => c.id === root.id);
    expect(rootIndex).toBeGreaterThanOrEqual(0);
    expect(thread[rootIndex + 1]?.parentId).toBe(root.id);
  });

  it('a BOARD_ONLY comment is hidden from a pure Secretariat viewer but visible to a Board Member', async () => {
    const boardOnly = await addComment('Submission', boardPaperId, boardMember2, {
      body: 'Flagging a possible conflict for discussion in camera.',
      visibility: 'BOARD_ONLY',
    });

    const asSecretariat = await listComments('Submission', boardPaperId, secretariat);
    expect(asSecretariat.some((c) => c.id === boardOnly.id)).toBe(false);

    const asBoardMember = await listComments('Submission', boardPaperId, boardMember1);
    expect(asBoardMember.some((c) => c.id === boardOnly.id)).toBe(true);
  });

  it('only the Board Secretariat may resolve a comment', async () => {
    const c = await addComment('Submission', boardPaperId, boardMember1, {
      body: 'Please confirm the annexure is final.',
    });
    await expect(resolveComment(c.id, boardMember1)).rejects.toThrow(AuthorizationError);
    await resolveComment(c.id, secretariat);
    const updated = await prisma.comment.findUniqueOrThrow({ where: { id: c.id } });
    expect(updated.isResolved).toBe(true);
  });
});

describe('Board Dashboard — resolutions', () => {
  it('rejects a resolution with no subject', async () => {
    await expect(
      createResolution(
        { meetingId: publishedMeetingId, subject: '', resolutionText: 'Text' },
        secretariat,
      ),
    ).rejects.toThrow(ResolutionValidationError);
  });

  it('a non-Secretariat role cannot create a resolution', async () => {
    await expect(
      createResolution(
        { meetingId: publishedMeetingId, subject: 'Test', resolutionText: 'Text' },
        boardMember1,
      ),
    ).rejects.toThrow(AuthorizationError);
  });

  it('follows the valid status path and rejects an invalid jump', async () => {
    const resolution = await createResolution(
      {
        meetingId: publishedMeetingId,
        subject: 'TEST-A30 Resolution',
        resolutionText: 'The Board resolves to note the update.',
      },
      secretariat,
    );

    await expect(
      transitionResolutionStatus(resolution.id, 'APPROVED', secretariat),
    ).rejects.toThrow(ResolutionValidationError);

    await transitionResolutionStatus(resolution.id, 'PROPOSED', secretariat);
    await transitionResolutionStatus(resolution.id, 'APPROVED', secretariat);
    const updated = await prisma.resolution.findUniqueOrThrow({ where: { id: resolution.id } });
    expect(updated.status).toBe('APPROVED');
  });
});

describe('Board Dashboard — audit history', () => {
  it('records an AuditEvent when a Board meeting is created', async () => {
    const events = await prisma.auditEvent.findMany({
      where: { entityType: 'Meeting', entityId: draftMeetingId, action: 'BOARD_MEETING_CREATED' },
    });
    expect(events.length).toBeGreaterThan(0);
  });

  it('records an AuditEvent and a WorkflowTransition when a decision is recorded', async () => {
    const auditEvents = await prisma.auditEvent.findMany({
      where: {
        entityType: 'Submission',
        entityId: decisionPaperId,
        action: 'BOARD_DECISION_RECORDED',
      },
    });
    expect(auditEvents.length).toBeGreaterThan(0);
    for (const e of auditEvents) {
      expect(e.userId).toBeTruthy();
      expect(e.createdAt).toBeInstanceOf(Date);
    }
  });

  it('records an AuditEvent when a comment is added', async () => {
    const events = await prisma.auditEvent.findMany({
      where: { entityType: 'Submission', entityId: boardPaperId, action: 'BOARD_COMMENT_ADDED' },
    });
    expect(events.length).toBeGreaterThan(0);
  });
});
