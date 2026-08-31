import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole } from '@/lib/auth/rbac';
import { getReportingWeekFor } from '@/lib/reporting/weeklyDeadline';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { DirectorSummary } from '@prisma/client';

const DIRECTOR_ROLES = ['SUBMITTER', 'SYSTEM_ADMIN'] as const;
const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

export class DirectorSummaryValidationError extends Error {}

export interface UpsertDirectorSummaryInput {
  departmentId: string;
  keyAchievements?: string;
  kpiKraProgressNote?: string;
  milestonesNote?: string;
  criticalActivities?: string;
  delays?: string;
  risks?: string;
  decisionsRequired?: string;
  nextPeriodPriorities?: string;
  referenceDate?: Date;
}

/** One row per department per reporting week, consolidated by the Director from that week's
 * Weekly Manager Reports — the narrative "Director Summary" the client's spec asks for, which no
 * existing function in this codebase produced (docs/ceo-portal-requirements-review.md's WMR-7
 * finding). Upsert, not append-only versioned, since a Director revising their own not-yet-CEO-
 * validated summary is an edit, not a new historical fact — the CEO validation step below is what
 * gets audited.
 */
export async function upsertDirectorSummary(
  input: UpsertDirectorSummaryInput,
  actingUser: AuthenticatedUser,
): Promise<DirectorSummary> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const week = getReportingWeekFor(input.referenceDate);
  const period = await prisma.reportingPeriod.upsert({
    where: { code: week.code },
    update: {},
    create: {
      code: week.code,
      label: week.label,
      periodType: 'Weekly',
      startDate: week.weekStart,
      endDate: week.weekEnd,
    },
  });

  const summary = await prisma.directorSummary.upsert({
    where: { departmentId_reportingPeriodId: { departmentId: input.departmentId, reportingPeriodId: period.id } },
    update: {
      keyAchievements: input.keyAchievements,
      kpiKraProgressNote: input.kpiKraProgressNote,
      milestonesNote: input.milestonesNote,
      criticalActivities: input.criticalActivities,
      delays: input.delays,
      risks: input.risks,
      decisionsRequired: input.decisionsRequired,
      nextPeriodPriorities: input.nextPeriodPriorities,
      lastReportingDate: new Date(),
      ceoValidationStatus: 'SUBMITTED',
    },
    create: {
      departmentId: input.departmentId,
      reportingPeriodId: period.id,
      keyAchievements: input.keyAchievements,
      kpiKraProgressNote: input.kpiKraProgressNote,
      milestonesNote: input.milestonesNote,
      criticalActivities: input.criticalActivities,
      delays: input.delays,
      risks: input.risks,
      decisionsRequired: input.decisionsRequired,
      nextPeriodPriorities: input.nextPeriodPriorities,
      lastReportingDate: new Date(),
      directorId: actingUser.id,
      createdById: actingUser.id,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'DIRECTOR_SUMMARY_SUBMITTED',
    entityType: 'DirectorSummary',
    entityId: summary.id,
    newState: { departmentId: input.departmentId, weekCode: week.code },
  });

  return summary;
}

async function ceoDecide(
  summaryId: string,
  actingUser: AuthenticatedUser,
  toStatus: 'VALIDATED' | 'RETURNED_FOR_CLARIFICATION',
  comment?: string,
): Promise<DirectorSummary> {
  requireAnyRole(actingUser, CEO_ROLES);
  const summary = await prisma.directorSummary.findUniqueOrThrow({ where: { id: summaryId } });

  const updated = await prisma.directorSummary.update({
    where: { id: summaryId },
    data: { ceoValidationStatus: toStatus, ceoComment: comment },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: `DIRECTOR_SUMMARY_${toStatus}`,
    entityType: 'DirectorSummary',
    entityId: summaryId,
    previousState: { ceoValidationStatus: summary.ceoValidationStatus },
    newState: { ceoValidationStatus: toStatus, comment },
  });

  await getNotificationProvider().notify({
    userId: summary.directorId,
    type: `DIRECTOR_SUMMARY_${toStatus}`,
    message:
      toStatus === 'VALIDATED'
        ? 'Your Director Summary was validated by the CEO.'
        : `Your Director Summary was returned for clarification: ${comment}`,
    linkUrl: `/department-dashboard/director-summary`,
  });

  return updated;
}

export const validateDirectorSummary = (id: string, actingUser: AuthenticatedUser, comment?: string) =>
  ceoDecide(id, actingUser, 'VALIDATED', comment);

export const returnDirectorSummaryForClarification = (
  id: string,
  actingUser: AuthenticatedUser,
  comment: string,
) => ceoDecide(id, actingUser, 'RETURNED_FOR_CLARIFICATION', comment);

/** The CEO's default per-department view — a Director Summary, never the raw Manager reports
 * underneath it (client: "The CEO sees only a departmental summary"). */
export async function listDirectorSummariesForCeo(
  actingUser: AuthenticatedUser,
  referenceDate: Date = new Date(),
) {
  requireAnyRole(actingUser, CEO_ROLES);
  const week = getReportingWeekFor(referenceDate);
  return prisma.directorSummary.findMany({
    where: { reportingPeriod: { code: week.code } },
    include: { department: true, director: true },
    orderBy: { department: { name: 'asc' } },
  });
}

export async function getDirectorSummaryForUser(summaryId: string, actingUser: AuthenticatedUser) {
  const summary = await prisma.directorSummary.findUnique({
    where: { id: summaryId },
    include: { department: true, director: true, reportingPeriod: true },
  });
  if (!summary) return null;
  const isCeo = actingUser.roles.some(
    (r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN',
  );
  const isOwnDirector = summary.directorId === actingUser.id;
  if (!isCeo && !isOwnDirector) {
    throw new DirectorSummaryValidationError('No access to this Director Summary.');
  }
  return summary;
}
