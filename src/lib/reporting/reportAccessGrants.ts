import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import type { AuthenticatedUser } from '@/lib/auth/types';

const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

export class ForwardAccessError extends Error {}

/**
 * The generic "Forward to CEO" object-level access grant — the primitive
 * docs/ceo-portal-requirements-review.md (WMR-5/RBAC-3) found entirely missing. Polymorphic
 * (entityType/entityId), pinned to the forwarded version, so it works for WeeklyManagerReport
 * today and any future entity without a schema change. Only ever grants read access to the exact
 * forwarded item/version — never a role or a standing permission.
 */
export async function forwardToCeo(params: {
  entityType: string;
  entityId: string;
  entityVersion?: number;
  reason?: string;
  actingUser: AuthenticatedUser;
  /** Manager forwarding: also notifies the responsible Director, per the client's requirement. */
  notifyDirectorId?: string;
}): Promise<void> {
  const { entityType, entityId, entityVersion, reason, actingUser, notifyDirectorId } = params;

  const ceo = await prisma.user.findFirst({
    where: { isActive: true, roles: { some: { role: { code: 'EXECUTIVE_VIEWER' } } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!ceo) throw new ForwardAccessError('No active CEO account is configured to forward to.');

  await prisma.reportAccessGrant.create({
    data: {
      entityType,
      entityId,
      entityVersion,
      grantedToUserId: ceo.id,
      grantedById: actingUser.id,
      reason,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'REPORT_FORWARDED_TO_CEO',
    entityType,
    entityId,
    newState: { entityVersion, reason, grantedToUserId: ceo.id },
  });

  await getNotificationProvider().notify({
    userId: ceo.id,
    type: 'REPORT_FORWARDED_TO_CEO',
    message: `${actingUser.name} forwarded a ${entityType} for your read-only review.${reason ? ` Reason: ${reason}` : ''}`,
    linkUrl: forwardLinkFor(entityType, entityId),
  });

  if (notifyDirectorId) {
    await getNotificationProvider().notify({
      userId: notifyDirectorId,
      type: 'REPORT_FORWARDED_TO_CEO_NOTICE',
      message: `${actingUser.name} forwarded a report to the CEO for direct review.`,
      linkUrl: forwardLinkFor(entityType, entityId),
    });
  }
}

function forwardLinkFor(entityType: string, entityId: string): string {
  if (entityType === 'WeeklyManagerReport') {
    return `/department-dashboard/weekly-reports/${entityId}`;
  }
  return '/executive-dashboard';
}

/** Whether `userId` currently holds a forwarded-access grant for this exact entity/version (or an
 * un-versioned grant, if the entity has no version concept). */
export async function hasForwardedAccess(
  entityType: string,
  entityId: string,
  userId: string,
  currentVersion?: number,
): Promise<boolean> {
  const grant = await prisma.reportAccessGrant.findFirst({
    where: {
      entityType,
      entityId,
      grantedToUserId: userId,
      ...(currentVersion !== undefined ? { entityVersion: currentVersion } : {}),
    },
  });
  return Boolean(grant);
}

export async function listForwardedReportsForCeo(actingUser: AuthenticatedUser) {
  const { requireAnyRole } = await import('@/lib/auth/rbac');
  requireAnyRole(actingUser, CEO_ROLES);
  return prisma.reportAccessGrant.findMany({
    where: { grantedToUserId: actingUser.id },
    orderBy: { createdAt: 'desc' },
  });
}
