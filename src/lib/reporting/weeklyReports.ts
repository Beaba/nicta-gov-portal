import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole } from '@/lib/auth/rbac';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import { getReportingWeekFor, isPastWeeklyDeadline, type ReportingWeek } from '@/lib/reporting/weeklyDeadline';
import { transitionWeeklyReport } from '@/lib/reporting/weeklyReportWorkflow';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { WeeklyManagerReport } from '@prisma/client';

const MANAGER_ROLES = ['MANAGER', 'SYSTEM_ADMIN'] as const;
const DIRECTOR_ROLES = ['SUBMITTER', 'DIRECTOR', 'SYSTEM_ADMIN'] as const;
const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

export class WeeklyReportValidationError extends Error {}

/** Get-or-create the ReportingPeriod row for the week containing `referenceDate` — one row per
 * calendar week, `periodType: 'Weekly'`, reused across every Manager/department reporting into
 * that same week (mirrors ReportingPeriod's existing Monthly-row pattern from #A31's
 * seedDepartmentPerformance, just a finer grain). */
async function getOrCreateWeeklyPeriod(week: ReportingWeek) {
  return prisma.reportingPeriod.upsert({
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
}

export interface SubmitWeeklyReportInput {
  departmentId: string;
  activityId?: string;
  category: 'Project' | 'BAU' | 'Ad-hoc';
  kpiKraContribution?: string;
  progressPercent: number;
  workCompleted: string;
  milestonesAchieved?: string;
  plannedWork?: string;
  delays?: string;
  risks?: string;
  decisionsRequired?: string;
  dueDate?: Date;
  lateJustification?: string;
  referenceDate?: Date;
}

/**
 * Manager submits a weekly report. At the 5pm-Friday-PGT deadline (client's fixed cadence, see
 * weeklyDeadline.ts): the normal window closes, a late submission requires
 * `lateJustification`, lands on LATE instead of SUBMITTED, and the responsible Director is
 * notified — all four of the client's "at the deadline" requirements in one call, matching the
 * existing SMC-submission late-handling pattern (#A27) applied to this new entity.
 */
export async function submitWeeklyReport(
  input: SubmitWeeklyReportInput,
  actingUser: AuthenticatedUser,
): Promise<WeeklyManagerReport> {
  requireAnyRole(actingUser, MANAGER_ROLES);
  if (!input.workCompleted.trim()) {
    throw new WeeklyReportValidationError('Describe the work completed this week.');
  }

  const week = getReportingWeekFor(input.referenceDate);
  const period = await getOrCreateWeeklyPeriod(week);
  const isLate = isPastWeeklyDeadline(week, input.referenceDate ?? new Date());
  if (isLate && !input.lateJustification?.trim()) {
    throw new WeeklyReportValidationError(
      'The weekly reporting deadline (5:00 PM Friday, PGT) has passed — a late explanation is required.',
    );
  }

  const year = new Date().getFullYear().toString();
  const referenceNumber = await nextReferenceNumber('WR', year);

  const report = await prisma.weeklyManagerReport.create({
    data: {
      referenceNumber,
      reportingPeriodId: period.id,
      departmentId: input.departmentId,
      managerId: actingUser.id,
      activityId: input.activityId,
      category: input.category,
      kpiKraContribution: input.kpiKraContribution,
      progressPercent: Math.max(0, Math.min(100, input.progressPercent)),
      workCompleted: input.workCompleted,
      milestonesAchieved: input.milestonesAchieved,
      plannedWork: input.plannedWork,
      delays: input.delays,
      risks: input.risks,
      decisionsRequired: input.decisionsRequired,
      dueDate: input.dueDate,
      isLate,
      lateJustification: isLate ? input.lateJustification : null,
      status: isLate ? 'LATE' : 'SUBMITTED',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: isLate ? 'WEEKLY_REPORT_SUBMITTED_LATE' : 'WEEKLY_REPORT_SUBMITTED',
    entityType: 'WeeklyManagerReport',
    entityId: report.id,
    newState: { referenceNumber, isLate, weekCode: week.code },
    correlationRef: referenceNumber,
  });

  const director = await findDepartmentDirector(input.departmentId);
  if (director) {
    await getNotificationProvider().notify({
      userId: director.id,
      type: isLate ? 'WEEKLY_REPORT_LATE' : 'WEEKLY_REPORT_SUBMITTED',
      message: isLate
        ? `${actingUser.name} submitted a LATE weekly report (${referenceNumber}) for ${week.label}.`
        : `${actingUser.name} submitted a weekly report (${referenceNumber}) for ${week.label}.`,
      linkUrl: `/department-dashboard/weekly-reports/${report.id}`,
    });
  }

  return report;
}

async function findDepartmentDirector(departmentId: string) {
  return prisma.user.findFirst({
    where: {
      departmentId,
      isActive: true,
      roles: { some: { role: { code: 'SUBMITTER' } } },
    },
  });
}

function assertDirectorOwnsDepartment(actingUser: AuthenticatedUser, departmentId: string): void {
  const isAdmin = actingUser.roles.some((r) => r.roleCode === 'SYSTEM_ADMIN');
  if (isAdmin) return;
  const ownsDept = actingUser.departmentId === departmentId;
  if (!ownsDept) {
    throw new WeeklyReportValidationError('No access to this department’s weekly reports.');
  }
}

export async function reviewWeeklyReport(
  reportId: string,
  actingUser: AuthenticatedUser,
): Promise<WeeklyManagerReport> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const report = await prisma.weeklyManagerReport.findUniqueOrThrow({ where: { id: reportId } });
  assertDirectorOwnsDepartment(actingUser, report.departmentId);
  return transitionWeeklyReport({
    report,
    toState: 'UNDER_DIRECTOR_REVIEW',
    performedById: actingUser.id,
  });
}

export async function returnWeeklyReportForClarification(
  reportId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<WeeklyManagerReport> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  if (!comment.trim()) throw new WeeklyReportValidationError('A comment is required.');
  const report = await prisma.weeklyManagerReport.findUniqueOrThrow({ where: { id: reportId } });
  assertDirectorOwnsDepartment(actingUser, report.departmentId);

  const updated = await transitionWeeklyReport({
    report,
    toState: 'RETURNED_FOR_CLARIFICATION',
    performedById: actingUser.id,
    comment,
  });
  await prisma.weeklyManagerReport.update({
    where: { id: reportId },
    data: { directorReviewComment: comment },
  });

  await getNotificationProvider().notify({
    userId: report.managerId,
    type: 'WEEKLY_REPORT_RETURNED',
    message: `Your weekly report ${report.referenceNumber} was returned for clarification: ${comment}`,
    linkUrl: `/department-dashboard/weekly-reports/${report.id}`,
  });

  return updated;
}

export async function validateWeeklyReport(
  reportId: string,
  actingUser: AuthenticatedUser,
  comment?: string,
): Promise<WeeklyManagerReport> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const report = await prisma.weeklyManagerReport.findUniqueOrThrow({ where: { id: reportId } });
  assertDirectorOwnsDepartment(actingUser, report.departmentId);

  const updated = await transitionWeeklyReport({
    report,
    toState: 'VALIDATED_BY_DIRECTOR',
    performedById: actingUser.id,
    comment,
  });
  if (comment) {
    await prisma.weeklyManagerReport.update({
      where: { id: reportId },
      data: { directorReviewComment: comment, reviewedById: actingUser.id, reviewedAt: new Date() },
    });
  } else {
    await prisma.weeklyManagerReport.update({
      where: { id: reportId },
      data: { reviewedById: actingUser.id, reviewedAt: new Date() },
    });
  }
  return updated;
}

export interface ListWeeklyReportsFilter {
  departmentId?: string;
  weekCode?: string;
}

/** Object-level visibility: Manager sees their own, Director sees their department's, CEO/Admin
 * see none by default here (the CEO's default view is the department-level compliance summary,
 * listWeeklyComplianceSummary below — per-report detail requires either being the
 * Manager/Director, or a Forward-to-CEO grant, see reportAccessGrants.ts). */
export async function listWeeklyReportsForUser(
  actingUser: AuthenticatedUser,
  filter: ListWeeklyReportsFilter = {},
) {
  const isAdmin = actingUser.roles.some((r) => r.roleCode === 'SYSTEM_ADMIN');
  const isManager = actingUser.roles.some((r) => r.roleCode === 'MANAGER');
  const isDirector = actingUser.roles.some((r) => r.roleCode === 'SUBMITTER');

  const where: Record<string, unknown> = {};
  if (filter.departmentId) where.departmentId = filter.departmentId;
  if (filter.weekCode) where.reportingPeriod = { code: filter.weekCode };

  if (isAdmin) {
    // full visibility
  } else if (isDirector && actingUser.departmentId) {
    where.departmentId = actingUser.departmentId;
  } else if (isManager) {
    where.managerId = actingUser.id;
  } else {
    throw new WeeklyReportValidationError('No access to weekly reports.');
  }

  return prisma.weeklyManagerReport.findMany({
    where,
    include: { manager: true, department: true, reportingPeriod: true },
    orderBy: { createdAt: 'desc' },
  });
}

export interface DepartmentComplianceRow {
  departmentId: string;
  departmentName: string;
  managersExpected: number;
  reportsReceived: number;
  lateOrMissing: number;
  overallProgress: number | null;
}

/**
 * The CEO's default Weekly Management Overview — a departmental summary only (client: "Detailed
 * Manager reports remain restricted... The CEO sees only a departmental summary"). Never returns
 * individual report content.
 */
export async function listWeeklyComplianceSummary(
  actingUser: AuthenticatedUser,
  referenceDate: Date = new Date(),
): Promise<DepartmentComplianceRow[]> {
  requireAnyRole(actingUser, CEO_ROLES);
  const week = getReportingWeekFor(referenceDate);

  const [departments, managerCounts, reports] = await Promise.all([
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.userRole.groupBy({
      by: ['departmentId'],
      where: { role: { code: 'MANAGER' }, departmentId: { not: null } },
      _count: { _all: true },
    }),
    prisma.weeklyManagerReport.findMany({
      where: { reportingPeriod: { code: week.code } },
    }),
  ]);

  const expectedByDept = new Map(managerCounts.map((c) => [c.departmentId, c._count._all]));

  return departments.map((dept) => {
    const deptReports = reports.filter((r) => r.departmentId === dept.id);
    const lateOrMissing =
      deptReports.filter((r) => r.isLate).length +
      Math.max(0, (expectedByDept.get(dept.id) ?? 0) - deptReports.length);
    const progressValues = deptReports.map((r) => r.progressPercent);
    return {
      departmentId: dept.id,
      departmentName: dept.name,
      managersExpected: expectedByDept.get(dept.id) ?? 0,
      reportsReceived: deptReports.length,
      lateOrMissing,
      overallProgress: progressValues.length
        ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length)
        : null,
    };
  });
}

export async function getWeeklyReportForUser(reportId: string, actingUser: AuthenticatedUser) {
  const report = await prisma.weeklyManagerReport.findUnique({
    where: { id: reportId },
    include: {
      manager: true,
      department: true,
      reportingPeriod: true,
      evidence: true,
      activity: true,
      transitions: { orderBy: { performedAt: 'asc' } },
    },
  });
  if (!report) return null;

  const isAdmin = actingUser.roles.some((r) => r.roleCode === 'SYSTEM_ADMIN');
  const isOwner = report.managerId === actingUser.id;
  const isOwnDirector =
    actingUser.roles.some((r) => r.roleCode === 'SUBMITTER') &&
    actingUser.departmentId === report.departmentId;

  if (isAdmin || isOwner || isOwnDirector) return report;

  const { hasForwardedAccess } = await import('@/lib/reporting/reportAccessGrants');
  if (await hasForwardedAccess('WeeklyManagerReport', reportId, actingUser.id, report.version)) {
    return report;
  }

  throw new WeeklyReportValidationError('No access to this weekly report.');
}
