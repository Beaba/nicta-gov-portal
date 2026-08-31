import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { getCalendarProvider } from '@/lib/providers/calendar';
import { requireAnyRole } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { Appointment } from '@prisma/client';

const ORGANISER_ROLES = ['EXECUTIVE_VIEWER', 'CEO_OFFICE', 'SYSTEM_ADMIN'] as const;

export class AppointmentValidationError extends Error {}

export interface CreateAppointmentInput {
  title: string;
  agenda?: string;
  startAt: Date;
  endAt: Date;
  location?: string;
  inviteeUserIds: string[];
  createTeamsMeeting?: boolean;
}

export async function createAppointment(
  input: CreateAppointmentInput,
  actingUser: AuthenticatedUser,
): Promise<Appointment> {
  requireAnyRole(actingUser, ORGANISER_ROLES);
  if (!input.title.trim()) throw new AppointmentValidationError('Enter a title.');
  if (input.endAt <= input.startAt) throw new AppointmentValidationError('End time must be after the start time.');

  let teamsMeetingUrl: string | null = null;
  if (input.createTeamsMeeting) {
    try {
      const invitees = await prisma.user.findMany({ where: { id: { in: input.inviteeUserIds } } });
      const result = await getCalendarProvider().createTeamsMeeting({
        title: input.title,
        agenda: input.agenda,
        startAt: input.startAt,
        endAt: input.endAt,
        attendeeEmails: invitees.map((u) => u.email),
      });
      teamsMeetingUrl = result.teamsMeetingUrl;
    } catch {
      // Fails open on the Teams-link piece only — the appointment itself is still a real,
      // useful record even without a live Teams link (see calendar/mockProvider.ts's own
      // comment). The UI surfaces "Teams link unavailable" rather than blocking scheduling.
      teamsMeetingUrl = null;
    }
  }

  const appointment = await prisma.appointment.create({
    data: {
      title: input.title,
      agenda: input.agenda,
      startAt: input.startAt,
      endAt: input.endAt,
      location: input.location,
      teamsMeetingUrl,
      organiserId: actingUser.id,
      invitees: { create: input.inviteeUserIds.map((userId) => ({ userId })) },
    },
    include: { invitees: true },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'APPOINTMENT_CREATED',
    entityType: 'Appointment',
    entityId: appointment.id,
    newState: { title: input.title, startAt: input.startAt },
  });

  await Promise.all(
    input.inviteeUserIds.map((userId) =>
      getNotificationProvider().notify({
        userId,
        type: 'APPOINTMENT_INVITED',
        message: `You were invited to "${input.title}" on ${input.startAt.toLocaleString()}.`,
        linkUrl: `/executive-dashboard/appointments/${appointment.id}`,
      }),
    ),
  );

  return appointment;
}

export async function rescheduleAppointment(
  appointmentId: string,
  actingUser: AuthenticatedUser,
  startAt: Date,
  endAt: Date,
): Promise<Appointment> {
  requireAnyRole(actingUser, ORGANISER_ROLES);
  if (endAt <= startAt) throw new AppointmentValidationError('End time must be after the start time.');
  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { startAt, endAt, status: 'RESCHEDULED' },
    include: { invitees: true },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'APPOINTMENT_RESCHEDULED',
    entityType: 'Appointment',
    entityId: appointmentId,
    newState: { startAt, endAt },
  });

  await Promise.all(
    appointment.invitees.map((inv) =>
      getNotificationProvider().notify({
        userId: inv.userId,
        type: 'APPOINTMENT_RESCHEDULED',
        message: `"${appointment.title}" was rescheduled to ${startAt.toLocaleString()}.`,
        linkUrl: `/executive-dashboard/appointments/${appointmentId}`,
      }),
    ),
  );

  return appointment;
}

export async function cancelAppointment(appointmentId: string, actingUser: AuthenticatedUser): Promise<void> {
  requireAnyRole(actingUser, ORGANISER_ROLES);
  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: 'CANCELLED' },
    include: { invitees: true },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'APPOINTMENT_CANCELLED',
    entityType: 'Appointment',
    entityId: appointmentId,
  });

  await Promise.all(
    appointment.invitees.map((inv) =>
      getNotificationProvider().notify({
        userId: inv.userId,
        type: 'APPOINTMENT_CANCELLED',
        message: `"${appointment.title}" was cancelled.`,
        linkUrl: `/executive-dashboard/appointments`,
      }),
    ),
  );
}

export async function sendAppointmentReminder(appointmentId: string, actingUser: AuthenticatedUser): Promise<void> {
  requireAnyRole(actingUser, ORGANISER_ROLES);
  const appointment = await prisma.appointment.findUniqueOrThrow({
    where: { id: appointmentId },
    include: { invitees: true },
  });
  await Promise.all(
    appointment.invitees.map((inv) =>
      getNotificationProvider().notify({
        userId: inv.userId,
        type: 'APPOINTMENT_REMINDER',
        message: `Reminder: "${appointment.title}" is at ${appointment.startAt.toLocaleString()}.`,
        linkUrl: `/executive-dashboard/appointments/${appointmentId}`,
      }),
    ),
  );
}

export async function recordAppointmentNotes(
  appointmentId: string,
  actingUser: AuthenticatedUser,
  meetingNotes: string,
): Promise<void> {
  requireAnyRole(actingUser, ORGANISER_ROLES);
  await prisma.appointment.update({ where: { id: appointmentId }, data: { meetingNotes } });
  await recordAuditEvent({
    userId: actingUser.id,
    action: 'APPOINTMENT_NOTES_RECORDED',
    entityType: 'Appointment',
    entityId: appointmentId,
  });
}

const INVITEE_RESPONSES = ['ACCEPTED', 'DECLINED', 'CLARIFICATION_REQUESTED', 'ALTERNATE_NOMINATED'] as const;
export type InviteeResponse = (typeof INVITEE_RESPONSES)[number];

export async function respondToAppointment(
  appointmentId: string,
  actingUser: AuthenticatedUser,
  response: InviteeResponse,
  responseReason?: string,
  alternateUserId?: string,
): Promise<void> {
  if ((response === 'DECLINED' || response === 'CLARIFICATION_REQUESTED') && !responseReason?.trim()) {
    throw new AppointmentValidationError('A reason is required.');
  }
  if (response === 'ALTERNATE_NOMINATED' && !alternateUserId) {
    throw new AppointmentValidationError('Select an alternate.');
  }

  const invitee = await prisma.appointmentInvitee.findUniqueOrThrow({
    where: { appointmentId_userId: { appointmentId, userId: actingUser.id } },
    include: { appointment: true },
  });

  await prisma.appointmentInvitee.update({
    where: { id: invitee.id },
    data: { response, responseReason, alternateUserId, respondedAt: new Date() },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'APPOINTMENT_INVITEE_RESPONDED',
    entityType: 'Appointment',
    entityId: appointmentId,
    newState: { response, responseReason },
  });

  await getNotificationProvider().notify({
    userId: invitee.appointment.organiserId,
    type: 'APPOINTMENT_INVITEE_RESPONDED',
    message: `${actingUser.name} responded "${response.replace(/_/g, ' ').toLowerCase()}" to "${invitee.appointment.title}".`,
    linkUrl: `/executive-dashboard/appointments/${appointmentId}`,
  });
}

export async function submitAppointmentPostEventReport(
  appointmentId: string,
  actingUser: AuthenticatedUser,
  storageKey: string,
  fileName: string,
  contentType: string,
  sizeBytes: number,
): Promise<void> {
  await prisma.evidence.create({
    data: {
      fileName,
      storageKey,
      contentType,
      sizeBytes,
      uploadedById: actingUser.id,
      appointmentId,
      role: 'OTHER',
      scanStatus: 'CLEAN',
    },
  });
  await recordAuditEvent({
    userId: actingUser.id,
    action: 'APPOINTMENT_POST_EVENT_REPORT_SUBMITTED',
    entityType: 'Appointment',
    entityId: appointmentId,
  });
}

export async function listAppointmentsForUser(actingUser: AuthenticatedUser) {
  const isOrganiser = actingUser.roles.some((r) =>
    (ORGANISER_ROLES as readonly string[]).includes(r.roleCode),
  );
  return prisma.appointment.findMany({
    where: isOrganiser
      ? {}
      : { invitees: { some: { userId: actingUser.id } } },
    include: { invitees: { include: { user: true } }, organiser: true },
    orderBy: { startAt: 'asc' },
  });
}

export async function getAppointmentForUser(appointmentId: string, actingUser: AuthenticatedUser) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { invitees: { include: { user: true } }, organiser: true, evidence: true },
  });
  if (!appointment) return null;
  const isOrganiser = actingUser.roles.some((r) =>
    (ORGANISER_ROLES as readonly string[]).includes(r.roleCode),
  );
  const isInvitee = appointment.invitees.some((i) => i.userId === actingUser.id);
  if (!isOrganiser && !isInvitee) {
    throw new AppointmentValidationError('No access to this appointment.');
  }
  return appointment;
}
