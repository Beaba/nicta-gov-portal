import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole, hasAnyRole, AuthorizationError } from '@/lib/auth/rbac';
import {
  SEMC_SECRETARIAT_ROLES,
  SEMC_ANY_ROLES,
  SEMC_CHAIR_ROLES,
} from '@/lib/semc/roles';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { Meeting } from '@prisma/client';

export class SemcValidationError extends Error {}

// #A32 — the SEMC meeting workspace, built by reusing the exact models already generalized for
// the Board Dashboard (Meeting/MeetingAgendaItem/MeetingMinutes/Resolution/Decision/ActionItem —
// none of them are hardcoded to `meetingType: BOARD` at the schema level, only the *board/* service
// layer's own role gates are). Rather than parametrize board/meetings.ts (touching tested,
// shipped code) or duplicate the data model, this is a parallel thin service module over the same
// tables with `meetingType: 'SMC'` and SEMC role gates — see
// docs/assumptions-and-decisions.md#A32 and docs/ceo-portal-requirements-review.md's SEMC-6
// finding, which this directly resolves.
export const SEMC_MEETING_STATES = [
  'DRAFT',
  'PUBLISHED',
  'IN_PROGRESS',
  'COMPLETED',
  'ARCHIVED',
  'CANCELLED',
] as const;
export type SemcMeetingState = (typeof SEMC_MEETING_STATES)[number];

const TRANSITIONS: Record<SemcMeetingState, SemcMeetingState[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: [],
  CANCELLED: [],
};

const VISIBLE_TO_MEMBERS: SemcMeetingState[] = ['PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

export interface CreateSemcWindowInput {
  title: string;
  meetingDate: Date;
  submissionOpenAt: Date;
  normalCloseAt: Date;
  lateCloseAt: Date;
  requiredDepartmentCodes?: string[];
  requiredAnnexures?: string[];
  permittedPaperTypes?: string[];
}

/** Corporate Secretariat configures one SEMC reporting window per meeting — opening date,
 * submission deadline, meeting date, required departments/annexures — reusing the existing
 * Meeting+Deadline pair (#A9/#A18), just with `meetingType: 'SMC'` and the two new Deadline
 * columns from #A32. */
export async function createSemcWindow(input: CreateSemcWindowInput, actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, SEMC_SECRETARIAT_ROLES);
  if (!input.title.trim()) throw new SemcValidationError('Enter a meeting title.');

  const year = new Date().getFullYear().toString();
  const meetingNumber = await nextReferenceNumber('SEMC', year);

  const meeting = await prisma.meeting.create({
    data: {
      meetingType: 'SMC',
      title: input.title,
      meetingNumber,
      meetingDate: input.meetingDate,
      status: 'DRAFT',
      deadline: {
        create: {
          submissionOpenAt: input.submissionOpenAt,
          normalCloseAt: input.normalCloseAt,
          lateCloseAt: input.lateCloseAt,
          permittedPaperTypes: JSON.stringify(input.permittedPaperTypes ?? []),
          requiredDepartments: JSON.stringify(input.requiredDepartmentCodes ?? []),
          requiredAnnexures: JSON.stringify(input.requiredAnnexures ?? []),
        },
      },
    },
    include: { deadline: true },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_WINDOW_CREATED',
    entityType: 'Meeting',
    entityId: meeting.id,
    newState: { title: input.title, meetingNumber },
    correlationRef: meetingNumber,
  });

  return meeting;
}

async function transitionMeeting(
  meeting: Meeting,
  toState: SemcMeetingState,
  actingUser: AuthenticatedUser,
): Promise<Meeting> {
  const fromState = meeting.status as SemcMeetingState;
  if (!TRANSITIONS[fromState]?.includes(toState)) {
    throw new SemcValidationError(`Cannot move a SEMC meeting from ${fromState} to ${toState}.`);
  }
  const updated = await prisma.meeting.update({ where: { id: meeting.id }, data: { status: toState } });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_MEETING_TRANSITION',
    entityType: 'Meeting',
    entityId: meeting.id,
    previousState: { status: fromState },
    newState: { status: toState },
    correlationRef: meeting.meetingNumber,
  });
  return updated;
}

export async function publishSemcMeeting(meetingId: string, actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, SEMC_SECRETARIAT_ROLES);
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  const updated = await transitionMeeting(meeting, 'PUBLISHED', actingUser);

  const members = await listSemcMembers();
  await Promise.all(
    members.map((m) =>
      getNotificationProvider().notify({
        userId: m.id,
        type: 'SEMC_MEETING_PUBLISHED',
        message: `SEMC meeting published: "${meeting.title}" on ${meeting.meetingDate.toLocaleDateString()}.`,
        linkUrl: `/executive-dashboard/semc/meetings/${meeting.id}`,
      }),
    ),
  );
  return updated;
}

export async function transitionSemcMeetingStatus(
  meetingId: string,
  toState: SemcMeetingState,
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, SEMC_SECRETARIAT_ROLES);
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  return transitionMeeting(meeting, toState, actingUser);
}

export async function listSemcMembers() {
  return prisma.user.findMany({
    where: {
      isActive: true,
      roles: { some: { role: { code: { in: ['SUBMITTER', 'SMC_MEMBER', 'REVIEWER_SECRETARIAT', 'EXECUTIVE_VIEWER'] } } } },
    },
    orderBy: { name: 'asc' },
  });
}

/** All permanent SEMC participants (CEO as Chairperson, all Directors, Corporate Secretariat) see
 * every published-or-later meeting; the Secretariat additionally sees drafts it is still
 * configuring. */
export async function listSemcMeetingsForUser(actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, SEMC_ANY_ROLES);
  const isSecretariat = hasAnyRole(actingUser, SEMC_SECRETARIAT_ROLES);
  return prisma.meeting.findMany({
    where: {
      meetingType: 'SMC',
      ...(isSecretariat ? {} : { status: { in: VISIBLE_TO_MEMBERS } }),
    },
    include: { deadline: true },
    orderBy: { meetingDate: 'desc' },
  });
}

export async function getSemcMeetingForUser(meetingId: string, actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, SEMC_ANY_ROLES);
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      deadline: true,
      agendaItems: { orderBy: { order: 'asc' }, include: { submission: { include: { department: true } } } },
      minutes: { orderBy: { version: 'desc' } },
      resolutions: true,
      actionItems: true,
    },
  });
  if (!meeting || meeting.meetingType !== 'SMC') return null;

  const isSecretariat = hasAnyRole(actingUser, SEMC_SECRETARIAT_ROLES);
  if (!isSecretariat && !VISIBLE_TO_MEMBERS.includes(meeting.status as SemcMeetingState)) {
    throw new AuthorizationError('This SEMC meeting has not been published yet.');
  }
  return meeting;
}

function assertAgendaEditable(meeting: Meeting): void {
  if (meeting.status !== 'DRAFT') {
    throw new SemcValidationError('The SEMC agenda is locked once the meeting is published.');
  }
}

export async function addSemcAgendaItem(
  meetingId: string,
  input: { title: string; description?: string; submissionId?: string },
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, SEMC_SECRETARIAT_ROLES);
  if (!input.title.trim()) throw new SemcValidationError('Enter an agenda item title.');
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });
  assertAgendaEditable(meeting);

  const count = await prisma.meetingAgendaItem.count({ where: { meetingId } });
  const item = await prisma.meetingAgendaItem.create({
    data: { meetingId, order: count, title: input.title, description: input.description, submissionId: input.submissionId },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_AGENDA_ITEM_ADDED',
    entityType: 'Meeting',
    entityId: meetingId,
    newState: { agendaItemId: item.id, title: input.title },
    correlationRef: meeting.meetingNumber,
  });
  return item;
}

export { SEMC_CHAIR_ROLES };
