import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  submitWeeklyReport,
  reviewWeeklyReport,
  validateWeeklyReport,
  returnWeeklyReportForClarification,
  getWeeklyReportForUser,
  WeeklyReportValidationError,
} from '@/lib/reporting/weeklyReports';
import { forwardToCeo, hasForwardedAccess } from '@/lib/reporting/reportAccessGrants';
import { getReportingWeekFor, isPastWeeklyDeadline } from '@/lib/reporting/weeklyDeadline';

// #A32 — Weekly Manager Reporting: the 5pm-Friday-PGT deadline, object-level visibility (a Manager
// sees only their own; the Director sees their department's; the CEO sees neither without a
// Forward-to-CEO grant), and the Director review/validate/return workflow.

let manager: AuthenticatedUser;
let otherManager: AuthenticatedUser;
let director: AuthenticatedUser;
let ceo: AuthenticatedUser;
const createdReportIds: string[] = [];

async function requireUserByEmail(email: string): Promise<AuthenticatedUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const loaded = await loadAuthenticatedUser(user.id);
  if (!loaded) throw new Error(`Could not load ${email}`);
  return loaded;
}

beforeAll(async () => {
  [manager, otherManager, director, ceo] = await Promise.all([
    requireUserByEmail('manager1.digital_transformation.demo@nicta.gov.pg'),
    requireUserByEmail('manager2.digital_transformation.demo@nicta.gov.pg'),
    requireUserByEmail('rasari@nicta.gov.pg'),
    requireUserByEmail('ceo.demo@nicta.gov.pg'),
  ]);
});

afterAll(async () => {
  if (createdReportIds.length) {
    await prisma.workflowTransition.deleteMany({ where: { entityType: 'WeeklyManagerReport' } });
    await prisma.auditEvent.deleteMany({ where: { entityType: 'WeeklyManagerReport', entityId: { in: createdReportIds } } });
    await prisma.reportAccessGrant.deleteMany({ where: { entityType: 'WeeklyManagerReport', entityId: { in: createdReportIds } } });
    await prisma.weeklyManagerReport.deleteMany({ where: { id: { in: createdReportIds } } });
  }
});

describe('weeklyDeadline — Friday 5pm PGT', () => {
  it('computes a deadline that is a Friday at 17:00 in Pacific/Port_Moresby', () => {
    const week = getReportingWeekFor(new Date('2026-03-10T00:00:00Z'));
    const deadlinePgt = new Date(week.deadlineAt).toLocaleString('en-US', { timeZone: 'Pacific/Port_Moresby', weekday: 'long', hour: 'numeric', hour12: false });
    expect(deadlinePgt).toContain('Friday');
  });

  it('a report submitted before the deadline is not late', () => {
    const week = getReportingWeekFor(new Date('2026-03-10T00:00:00Z'));
    const beforeDeadline = new Date(week.deadlineAt.getTime() - 60 * 60 * 1000);
    expect(isPastWeeklyDeadline(week, beforeDeadline)).toBe(false);
  });

  it('a report submitted after the deadline is late', () => {
    const week = getReportingWeekFor(new Date('2026-03-10T00:00:00Z'));
    const afterDeadline = new Date(week.deadlineAt.getTime() + 60 * 60 * 1000);
    expect(isPastWeeklyDeadline(week, afterDeadline)).toBe(true);
  });
});

describe('Weekly Manager Reports — deadline enforcement', () => {
  it('a late submission without justification is rejected', async () => {
    const week = getReportingWeekFor(new Date('2026-03-10T00:00:00Z'));
    const lateMoment = new Date(week.deadlineAt.getTime() + 60 * 60 * 1000);
    await expect(
      submitWeeklyReport(
        {
          departmentId: manager.departmentId!,
          category: 'BAU',
          progressPercent: 50,
          workCompleted: 'Test work.',
          referenceDate: lateMoment,
        },
        manager,
      ),
    ).rejects.toThrow(WeeklyReportValidationError);
  });

  it('a late submission with justification is accepted and marked LATE', async () => {
    const week = getReportingWeekFor(new Date('2026-03-10T00:00:00Z'));
    const lateMoment = new Date(week.deadlineAt.getTime() + 60 * 60 * 1000);
    const report = await submitWeeklyReport(
      {
        departmentId: manager.departmentId!,
        category: 'BAU',
        progressPercent: 50,
        workCompleted: 'Test work, submitted late.',
        lateJustification: 'System outage delayed submission.',
        referenceDate: lateMoment,
      },
      manager,
    );
    createdReportIds.push(report.id);
    expect(report.status).toBe('LATE');
    expect(report.isLate).toBe(true);
  });
});

describe('Weekly Manager Reports — object-level visibility', () => {
  let reportId: string;

  beforeAll(async () => {
    const week = getReportingWeekFor(new Date('2026-04-14T00:00:00Z'));
    const onTime = new Date(week.deadlineAt.getTime() - 60 * 60 * 1000);
    const report = await submitWeeklyReport(
      {
        departmentId: manager.departmentId!,
        category: 'Project',
        progressPercent: 60,
        workCompleted: 'Visibility test report.',
        referenceDate: onTime,
      },
      manager,
    );
    createdReportIds.push(report.id);
    reportId = report.id;
  });

  it('the submitting Manager can view their own report', async () => {
    const report = await getWeeklyReportForUser(reportId, manager);
    expect(report?.id).toBe(reportId);
  });

  it('a different Manager cannot view it', async () => {
    await expect(getWeeklyReportForUser(reportId, otherManager)).rejects.toThrow(WeeklyReportValidationError);
  });

  it('the responsible Director can view it (same department)', async () => {
    const report = await getWeeklyReportForUser(reportId, director);
    expect(report?.id).toBe(reportId);
  });

  it('the CEO cannot view the raw report by default', async () => {
    await expect(getWeeklyReportForUser(reportId, ceo)).rejects.toThrow(WeeklyReportValidationError);
  });

  it('after Forward to CEO, the CEO gains access to that exact version, audited', async () => {
    await forwardToCeo({
      entityType: 'WeeklyManagerReport',
      entityId: reportId,
      entityVersion: 1,
      reason: 'CEO requested visibility.',
      actingUser: manager,
    });
    const granted = await hasForwardedAccess('WeeklyManagerReport', reportId, ceo.id, 1);
    expect(granted).toBe(true);

    const event = await prisma.auditEvent.findFirst({
      where: { action: 'REPORT_FORWARDED_TO_CEO', entityType: 'WeeklyManagerReport', entityId: reportId },
    });
    expect(event).not.toBeNull();
    expect(event!.userId).toBe(manager.id);

    const report = await getWeeklyReportForUser(reportId, ceo);
    expect(report?.id).toBe(reportId);
  });
});

describe('Weekly Manager Reports — Director review workflow', () => {
  let reportId: string;

  beforeAll(async () => {
    const week = getReportingWeekFor(new Date('2026-05-12T00:00:00Z'));
    const onTime = new Date(week.deadlineAt.getTime() - 60 * 60 * 1000);
    const report = await submitWeeklyReport(
      {
        departmentId: manager.departmentId!,
        category: 'BAU',
        progressPercent: 30,
        workCompleted: 'Review workflow test report.',
        referenceDate: onTime,
      },
      manager,
    );
    createdReportIds.push(report.id);
    reportId = report.id;
  });

  it('an unrelated Director cannot review it', async () => {
    const otherDirector = await requireUserByEmail('sanda@nicta.gov.pg');
    await expect(reviewWeeklyReport(reportId, otherDirector)).rejects.toThrow(WeeklyReportValidationError);
  });

  it('the Director can move it to UNDER_DIRECTOR_REVIEW', async () => {
    const updated = await reviewWeeklyReport(reportId, director);
    expect(updated.status).toBe('UNDER_DIRECTOR_REVIEW');
  });

  it('returning for clarification requires a comment', async () => {
    await expect(returnWeeklyReportForClarification(reportId, director, '')).rejects.toThrow(
      WeeklyReportValidationError,
    );
  });

  it('the Director can validate', async () => {
    const updated = await validateWeeklyReport(reportId, director, 'Confirmed.');
    expect(updated.status).toBe('VALIDATED_BY_DIRECTOR');
  });
});
