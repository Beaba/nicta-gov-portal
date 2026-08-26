import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole, hasAnyRole, AuthorizationError } from '@/lib/auth/rbac';
import { BOARD_MEMBER_ROLES, BOARD_SECRETARIAT_ROLES, BOARD_ANY_ROLES } from '@/lib/board/roles';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { Meeting } from '@prisma/client';

export class BoardValidationError extends Error {}

// The Board-specific status vocabulary added in #A30 (see schema.prisma's MeetingStatus comment).
// A meeting is visible to Board Members from PUBLISHED onward — DRAFT is Secretariat-only working
// state, matching "Board Members can only view published meetings."
export const BOARD_MEETING_STATES = [
  'DRAFT',
  'PUBLISHED',
  'IN_PROGRESS',
  'COMPLETED',
  'ARCHIVED',
  'CANCELLED',
] as const;
export type BoardMeetingState = (typeof BOARD_MEETING_STATES)[number];

const TRANSITIONS: Record<BoardMeetingState, BoardMeetingState[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
  CANCELLED: [],
};

const VISIBLE_TO_BOARD_MEMBERS: BoardMeetingState[] = [
  'PUBLISHED',
  'IN_PROGRESS',
  'COMPLETED',
  'ARCHIVED',
];

export interface CreateBoardMeetingInput {
  title: string;
  meetingDate: Date;
  venue?: string;
}

export async function createBoardMeeting(
  input: CreateBoardMeetingInput,
  actingUser: AuthenticatedUser,
): Promise<Meeting> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  if (!input.title.trim()) throw new BoardValidationError('Enter a meeting title.');

  const year = new Date().getFullYear().toString();
  const meetingNumber = await nextReferenceNumber('BOARD', year);

  const meeting = await prisma.meeting.create({
    data: {
      meetingType: 'BOARD',
      title: input.title,
      meetingNumber,
      meetingDate: input.meetingDate,
      venue: input.venue,
      status: 'DRAFT',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_MEETING_CREATED',
    entityType: 'Meeting',
    entityId: meeting.id,
    newState: { title: input.title, meetingNumber },
    correlationRef: meetingNumber,
  });

  return meeting;
}

async function transitionMeeting(
  meeting: Meeting,
  toState: BoardMeetingState,
  actingUser: AuthenticatedUser,
): Promise<Meeting> {
  const fromState = meeting.status as BoardMeetingState;
  const allowed = TRANSITIONS[fromState];
  if (!allowed?.includes(toState)) {
    throw new BoardValidationError(`Cannot move a meeting from ${fromState} to ${toState}.`);
  }

  const updated = await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: toState },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_MEETING_TRANSITION',
    entityType: 'Meeting',
    entityId: meeting.id,
    previousState: { status: fromState },
    newState: { status: toState },
    correlationRef: meeting.meetingNumber,
  });

  return updated;
}

/** Publishing is also the "lock the agenda" moment — see addAgendaItem's status guard below. Every
 * active Board Member is notified so "new meeting published" (client's notification list) fires
 * from exactly one call site. */
export async function publishBoardMeeting(
  meetingId: string,
  actingUser: AuthenticatedUser,
): Promise<Meeting> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  const updated = await transitionMeeting(meeting, 'PUBLISHED', actingUser);

  const boardMembers = await listActiveBoardMembers();
  await Promise.all(
    boardMembers.map((m) =>
      getNotificationProvider().notify({
        userId: m.id,
        type: 'BOARD_MEETING_PUBLISHED',
        message: `A new Board meeting has been published: "${meeting.title}" on ${meeting.meetingDate.toLocaleDateString()}.`,
        linkUrl: `/board/meetings/${meeting.id}`,
      }),
    ),
  );

  return updated;
}

export async function transitionBoardMeetingStatus(
  meetingId: string,
  toState: BoardMeetingState,
  actingUser: AuthenticatedUser,
): Promise<Meeting> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  return transitionMeeting(meeting, toState, actingUser);
}

function assertAgendaEditable(meeting: Meeting): void {
  if (meeting.status !== 'DRAFT') {
    throw new BoardValidationError(
      'The agenda is locked once the meeting is published — create a new agenda item is not possible after publishing.',
    );
  }
}

export async function addAgendaItem(
  meetingId: string,
  input: { title: string; description?: string; submissionId?: string },
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  if (!input.title.trim()) throw new BoardValidationError('Enter an agenda item title.');
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  assertAgendaEditable(meeting);

  const count = await prisma.meetingAgendaItem.count({ where: { meetingId } });
  const item = await prisma.meetingAgendaItem.create({
    data: {
      meetingId,
      order: count,
      title: input.title,
      description: input.description,
      submissionId: input.submissionId,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_AGENDA_ITEM_ADDED',
    entityType: 'Meeting',
    entityId: meetingId,
    newState: { agendaItemId: item.id, title: input.title },
    correlationRef: meeting.meetingNumber,
  });

  return item;
}

export async function removeAgendaItem(
  agendaItemId: string,
  actingUser: AuthenticatedUser,
): Promise<void> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const item = await prisma.meetingAgendaItem.findUniqueOrThrow({
    where: { id: agendaItemId },
    include: { meeting: true },
  });
  assertAgendaEditable(item.meeting);
  await prisma.meetingAgendaItem.delete({ where: { id: agendaItemId } });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_AGENDA_ITEM_REMOVED',
    entityType: 'Meeting',
    entityId: item.meetingId,
    previousState: { agendaItemId, title: item.title },
    correlationRef: item.meeting.meetingNumber,
  });
}

export async function reorderAgendaItems(
  meetingId: string,
  orderedIds: string[],
  actingUser: AuthenticatedUser,
): Promise<void> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  assertAgendaEditable(meeting);

  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.meetingAgendaItem.update({ where: { id }, data: { order: index } }),
    ),
  );
}

export async function recordAttendance(
  meetingId: string,
  records: { userId: string; status: 'ATTENDED' | 'APOLOGY' | 'ABSENT' }[],
  actingUser: AuthenticatedUser,
): Promise<void> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  await Promise.all(
    records.map((r) =>
      prisma.meetingAttendance.upsert({
        where: { meetingId_userId: { meetingId, userId: r.userId } },
        create: { meetingId, userId: r.userId, status: r.status },
        update: { status: r.status, recordedAt: new Date() },
      }),
    ),
  );

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_ATTENDANCE_RECORDED',
    entityType: 'Meeting',
    entityId: meetingId,
    newState: { count: records.length },
  });
}

export async function listActiveBoardMembers() {
  return prisma.user.findMany({
    where: { isActive: true, roles: { some: { role: { code: 'BOARD_MEMBER' } } } },
    orderBy: { name: 'asc' },
  });
}

/** Board Members see only published-or-later meetings; Secretariat sees everything including
 * drafts. Matches "View published Board meetings" (Board Member) vs "Create and schedule Board
 * meetings" (Secretariat, which necessarily needs to see its own drafts). */
export async function listMeetingsForUser(actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, BOARD_ANY_ROLES);
  const isSecretariat = hasAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  return prisma.meeting.findMany({
    where: {
      meetingType: 'BOARD',
      ...(isSecretariat ? {} : { status: { in: VISIBLE_TO_BOARD_MEMBERS } }),
    },
    orderBy: { meetingDate: 'desc' },
  });
}

export async function getMeetingForUser(meetingId: string, actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, BOARD_ANY_ROLES);
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      agendaItems: { orderBy: { order: 'asc' }, include: { submission: true } },
      attendance: true,
      minutes: { orderBy: { version: 'desc' } },
      resolutions: true,
      actionItems: true,
    },
  });
  if (!meeting || meeting.meetingType !== 'BOARD') return null;

  const isSecretariat = hasAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  if (!isSecretariat && !VISIBLE_TO_BOARD_MEMBERS.includes(meeting.status as BoardMeetingState)) {
    throw new AuthorizationError('This meeting has not been published yet.');
  }

  return meeting;
}

export function isMeetingVisibleToBoardMembers(status: string): boolean {
  return VISIBLE_TO_BOARD_MEMBERS.includes(status as BoardMeetingState);
}

export { BOARD_MEMBER_ROLES };
