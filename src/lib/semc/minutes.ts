import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { getDocumentStorageProvider } from '@/lib/providers/documentStorage';
import { scanUpload } from '@/lib/providers/documentStorage/malwareScan';
import { requireAnyRole } from '@/lib/auth/rbac';
import { SEMC_SECRETARIAT_ROLES, SEMC_ANY_ROLES, SEMC_CHAIR_ROLES } from '@/lib/semc/roles';
import { listSemcMembers } from '@/lib/semc/meetings';
import type { AuthenticatedUser } from '@/lib/auth/types';

export class SemcMinutesValidationError extends Error {}

// #A32 — SEMC minutes, the same versioned upload/review/publish shape as board/minutes.ts (#A30),
// plus the two CEO-specific steps (Chairperson comment, confirm) the client's SEMC spec adds on
// top ("The CEO can: Review minutes, Add Chairperson comments, Return minutes for correction,
// Confirm the record") — DRAFT -> UNDER_REVIEW -> (CEO) CEO_REVIEWED | RETURNED_BY_CEO -> PUBLISHED.
export async function uploadSemcMinutes(
  meetingId: string,
  file: { buffer: Buffer; fileName: string; contentType: string },
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, SEMC_SECRETARIAT_ROLES);
  const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id: meetingId } });

  const scan = await scanUpload({
    buffer: file.buffer,
    contentType: file.contentType,
    sizeBytes: file.buffer.byteLength,
  });
  if (scan.status !== 'CLEAN') {
    throw new SemcMinutesValidationError(`Upload rejected: ${scan.status}${scan.reason ? ` — ${scan.reason}` : ''}`);
  }

  const latest = await prisma.meetingMinutes.findFirst({ where: { meetingId }, orderBy: { version: 'desc' } });
  const version = (latest?.version ?? 0) + 1;

  const storage = getDocumentStorageProvider();
  const stored = await storage.upload({
    buffer: file.buffer,
    fileName: file.fileName,
    contentType: file.contentType,
    placement: {
      kind: 'SEMC_MINUTES',
      meetingDate: meeting.meetingDate.toISOString(),
      meetingNumber: meeting.meetingNumber,
      version,
      fileName: file.fileName,
    },
  });

  const minutes = await prisma.meetingMinutes.create({
    data: { meetingId, version, status: 'DRAFT', storageKey: stored.storageKey, fileName: stored.fileName, uploadedById: actingUser.id },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_MINUTES_UPLOADED',
    entityType: 'Meeting',
    entityId: meetingId,
    newState: { minutesId: minutes.id, version },
    correlationRef: meeting.meetingNumber,
  });
  return minutes;
}

export async function submitSemcMinutesForCeoReview(minutesId: string, actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, SEMC_SECRETARIAT_ROLES);
  const minutes = await prisma.meetingMinutes.findUniqueOrThrow({ where: { id: minutesId }, include: { meeting: true } });
  if (minutes.status !== 'DRAFT') throw new SemcMinutesValidationError('Only draft minutes can be submitted for review.');

  await prisma.meetingMinutes.update({ where: { id: minutesId }, data: { status: 'UNDER_REVIEW' } });
  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_MINUTES_SUBMITTED_FOR_CEO_REVIEW',
    entityType: 'Meeting',
    entityId: minutes.meetingId,
    newState: { minutesId },
    correlationRef: minutes.meeting.meetingNumber,
  });

  const chair = await prisma.user.findFirst({ where: { isActive: true, roles: { some: { role: { code: 'EXECUTIVE_VIEWER' } } } } });
  if (chair) {
    await getNotificationProvider().notify({
      userId: chair.id,
      type: 'SEMC_MINUTES_READY_FOR_CEO_REVIEW',
      message: `Draft SEMC minutes for "${minutes.meeting.title}" are ready for your review as Chairperson.`,
      linkUrl: `/executive-dashboard/semc/meetings/${minutes.meetingId}`,
    });
  }
}

/** CEO confirms the record — minutes move straight to PUBLISHED, matching the client's "Confirm
 * the record" action. Chairperson comments themselves are recorded via the generic Comment model
 * (entityType "Meeting") so they appear in the same thread as everything else on the meeting. */
export async function confirmSemcMinutes(minutesId: string, actingUser: AuthenticatedUser): Promise<void> {
  requireAnyRole(actingUser, SEMC_CHAIR_ROLES);
  const minutes = await prisma.meetingMinutes.findUniqueOrThrow({ where: { id: minutesId }, include: { meeting: true } });
  if (minutes.status === 'PUBLISHED') throw new SemcMinutesValidationError('These minutes are already published.');

  await prisma.meetingMinutes.update({ where: { id: minutesId }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_MINUTES_CONFIRMED_BY_CEO',
    entityType: 'Meeting',
    entityId: minutes.meetingId,
    newState: { minutesId },
    correlationRef: minutes.meeting.meetingNumber,
  });

  const members = await listSemcMembers();
  await Promise.all(
    members.map((m) =>
      getNotificationProvider().notify({
        userId: m.id,
        type: 'SEMC_MINUTES_PUBLISHED',
        message: `Final SEMC minutes for "${minutes.meeting.title}" have been published.`,
        linkUrl: `/executive-dashboard/semc/meetings/${minutes.meetingId}`,
      }),
    ),
  );
}

export async function returnSemcMinutesForCorrection(
  minutesId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<void> {
  requireAnyRole(actingUser, SEMC_CHAIR_ROLES);
  if (!comment.trim()) throw new SemcMinutesValidationError('A comment is required to return minutes.');
  const minutes = await prisma.meetingMinutes.findUniqueOrThrow({ where: { id: minutesId }, include: { meeting: true } });

  await prisma.meetingMinutes.update({ where: { id: minutesId }, data: { status: 'DRAFT' } });
  await prisma.comment.create({
    data: { entityType: 'Meeting', entityId: minutes.meetingId, authorId: actingUser.id, body: comment },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'SEMC_MINUTES_RETURNED_BY_CEO',
    entityType: 'Meeting',
    entityId: minutes.meetingId,
    newState: { minutesId, comment },
    correlationRef: minutes.meeting.meetingNumber,
  });
}

export async function listSemcMinutesForUser(actingUser: AuthenticatedUser, search?: string) {
  requireAnyRole(actingUser, SEMC_ANY_ROLES);
  const isSecretariat = actingUser.roles.some(
    (r) => r.roleCode === 'REVIEWER_SECRETARIAT' || r.roleCode === 'SMC_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN',
  );
  return prisma.meetingMinutes.findMany({
    where: {
      meeting: { meetingType: 'SMC', ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}) },
      ...(isSecretariat ? {} : { status: 'PUBLISHED' }),
    },
    include: { meeting: true },
    orderBy: { uploadedAt: 'desc' },
  });
}
