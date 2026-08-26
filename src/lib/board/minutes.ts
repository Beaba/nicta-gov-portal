import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { getDocumentStorageProvider } from '@/lib/providers/documentStorage';
import { scanUpload } from '@/lib/providers/documentStorage/malwareScan';
import { requireAnyRole } from '@/lib/auth/rbac';
import { BOARD_SECRETARIAT_ROLES, BOARD_MEMBER_ROLES } from '@/lib/board/roles';
import { listActiveBoardMembers } from '@/lib/board/meetings';
import type { AuthenticatedUser } from '@/lib/auth/types';

export class MinutesValidationError extends Error {}

/** Every upload is a new version (append-only, #A6/#A27's convention) rather than overwriting the
 * previous row — a corrected draft after Board comments is version 2, not an edit to version 1. */
export async function uploadMinutes(
  meetingId: string,
  file: { buffer: Buffer; fileName: string; contentType: string },
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

  const scan = await scanUpload({
    buffer: file.buffer,
    contentType: file.contentType,
    sizeBytes: file.buffer.byteLength,
  });
  if (scan.status !== 'CLEAN') {
    throw new MinutesValidationError(
      `Upload rejected: ${scan.status}${scan.reason ? ` — ${scan.reason}` : ''}`,
    );
  }

  const latest = await prisma.meetingMinutes.findFirst({
    where: { meetingId },
    orderBy: { version: 'desc' },
  });
  const version = (latest?.version ?? 0) + 1;

  const storage = getDocumentStorageProvider();
  const stored = await storage.upload({
    buffer: file.buffer,
    fileName: file.fileName,
    contentType: file.contentType,
    placement: {
      kind: 'BOARD_MINUTES',
      meetingDate: meeting.meetingDate.toISOString(),
      meetingNumber: meeting.meetingNumber,
      version,
      fileName: file.fileName,
    },
  });

  const minutes = await prisma.meetingMinutes.create({
    data: {
      meetingId,
      version,
      status: 'DRAFT',
      storageKey: stored.storageKey,
      fileName: stored.fileName,
      uploadedById: actingUser.id,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_MINUTES_UPLOADED',
    entityType: 'Meeting',
    entityId: meetingId,
    newState: { minutesId: minutes.id, version },
    correlationRef: meeting.meetingNumber,
  });

  return minutes;
}

export async function submitMinutesForReview(
  minutesId: string,
  actingUser: AuthenticatedUser,
): Promise<void> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const minutes = await prisma.meetingMinutes.findUniqueOrThrow({
    where: { id: minutesId },
    include: { meeting: true },
  });
  if (minutes.status !== 'DRAFT') {
    throw new MinutesValidationError('Only draft minutes can be submitted for review.');
  }
  await prisma.meetingMinutes.update({
    where: { id: minutesId },
    data: { status: 'UNDER_REVIEW' },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_MINUTES_SUBMITTED_FOR_REVIEW',
    entityType: 'Meeting',
    entityId: minutes.meetingId,
    newState: { minutesId },
    correlationRef: minutes.meeting.meetingNumber,
  });

  const boardMembers = await listActiveBoardMembers();
  await Promise.all(
    boardMembers.map((m) =>
      getNotificationProvider().notify({
        userId: m.id,
        type: 'BOARD_MINUTES_READY_FOR_REVIEW',
        message: `Draft minutes for "${minutes.meeting.title}" are ready for your review.`,
        linkUrl: `/board/meetings/${minutes.meetingId}`,
      }),
    ),
  );
}

export async function publishMinutes(
  minutesId: string,
  actingUser: AuthenticatedUser,
): Promise<void> {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  const minutes = await prisma.meetingMinutes.findUniqueOrThrow({
    where: { id: minutesId },
    include: { meeting: true },
  });
  if (minutes.status === 'PUBLISHED') {
    throw new MinutesValidationError('These minutes are already published.');
  }

  await prisma.meetingMinutes.update({
    where: { id: minutesId },
    data: { status: 'PUBLISHED', publishedAt: new Date() },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_MINUTES_PUBLISHED',
    entityType: 'Meeting',
    entityId: minutes.meetingId,
    newState: { minutesId },
    correlationRef: minutes.meeting.meetingNumber,
  });
}

export async function listMinutesForUser(meetingId: string, actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, [...BOARD_MEMBER_ROLES, 'BOARD_SECRETARIAT']);
  return prisma.meetingMinutes.findMany({
    where: { meetingId },
    orderBy: { version: 'desc' },
  });
}
