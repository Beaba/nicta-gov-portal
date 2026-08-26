import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole } from '@/lib/auth/rbac';
import { BOARD_SECRETARIAT_ROLES, BOARD_ANY_ROLES } from '@/lib/board/roles';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import type { AuthenticatedUser } from '@/lib/auth/types';

export class ResolutionValidationError extends Error {}

export const RESOLUTION_STATUSES = [
  'DRAFT',
  'PROPOSED',
  'APPROVED',
  'DEFERRED',
  'REJECTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CLOSED',
] as const;
export type ResolutionStatus = (typeof RESOLUTION_STATUSES)[number];

const TRANSITIONS: Record<ResolutionStatus, ResolutionStatus[]> = {
  DRAFT: ['PROPOSED'],
  PROPOSED: ['APPROVED', 'DEFERRED', 'REJECTED'],
  APPROVED: ['IN_PROGRESS'],
  DEFERRED: ['PROPOSED'],
  REJECTED: [],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
};

export interface CreateResolutionInput {
  meetingId: string;
  agendaItemId?: string;
  subject: string;
  resolutionText: string;
  responsiblePersonId?: string;
  responsibleDepartmentId?: string;
  dueDate?: Date;
  submissionId?: string;
}

/** "Allow the Board Secretariat to create resolutions from agenda items" — agendaItemId is
 * optional so a resolution can also be recorded standalone against just the meeting. */
export async function createResolution(
  input: CreateResolutionInput,
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  if (!input.subject.trim()) throw new ResolutionValidationError('Enter a subject.');
  if (!input.resolutionText.trim())
    throw new ResolutionValidationError('Enter the resolution wording.');

  const year = new Date().getFullYear().toString();
  const resolutionNumber = await nextReferenceNumber('RES', year);

  const resolution = await prisma.resolution.create({
    data: {
      meetingId: input.meetingId,
      agendaItemId: input.agendaItemId,
      resolutionNumber,
      subject: input.subject,
      resolutionText: input.resolutionText,
      responsiblePersonId: input.responsiblePersonId,
      responsibleDepartmentId: input.responsibleDepartmentId,
      dueDate: input.dueDate,
      submissionId: input.submissionId,
      status: 'DRAFT',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_RESOLUTION_CREATED',
    entityType: 'Resolution',
    entityId: resolution.id,
    newState: { resolutionNumber, subject: input.subject },
    correlationRef: resolutionNumber,
  });

  return resolution;
}

export async function transitionResolutionStatus(
  resolutionId: string,
  toStatus: ResolutionStatus,
  actingUser: AuthenticatedUser,
  followUpNotes?: string,
): Promise<void> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const resolution = await prisma.resolution.findUniqueOrThrow({ where: { id: resolutionId } });
  const fromStatus = resolution.status as ResolutionStatus;
  const allowed = TRANSITIONS[fromStatus];
  if (!allowed?.includes(toStatus)) {
    throw new ResolutionValidationError(
      `Cannot move a resolution from ${fromStatus} to ${toStatus}.`,
    );
  }

  await prisma.resolution.update({
    where: { id: resolutionId },
    data: { status: toStatus, followUpNotes: followUpNotes ?? resolution.followUpNotes },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_RESOLUTION_TRANSITION',
    entityType: 'Resolution',
    entityId: resolutionId,
    previousState: { status: fromStatus },
    newState: { status: toStatus },
    correlationRef: resolution.resolutionNumber,
  });

  if (toStatus === 'APPROVED' && resolution.responsiblePersonId) {
    await getNotificationProvider().notify({
      userId: resolution.responsiblePersonId,
      type: 'BOARD_RESOLUTION_ASSIGNED',
      message: `Resolution ${resolution.resolutionNumber} "${resolution.subject}" was approved and assigned to you.`,
      linkUrl: `/board/resolutions/${resolution.id}`,
    });
  }
}

export async function listResolutionsForUser(actingUser: AuthenticatedUser, meetingId?: string) {
  requireAnyRole(actingUser, BOARD_ANY_ROLES);
  return prisma.resolution.findMany({
    where: meetingId ? { meetingId } : {},
    include: { meeting: true, responsibleDepartment: true },
    orderBy: { adoptedAt: 'desc' },
  });
}

export async function getResolutionForUser(resolutionId: string, actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, BOARD_ANY_ROLES);
  return prisma.resolution.findUnique({
    where: { id: resolutionId },
    include: { meeting: true, responsibleDepartment: true, submission: true, actionItems: true },
  });
}
