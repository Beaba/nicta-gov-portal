import { DateTime } from 'luxon';

// #A32 — the client's fixed weekly deadline: 5:00 PM every Friday, Papua New Guinea time. Computed
// with luxon against `Pacific/Port_Moresby` (never the server's local zone or the client's), same
// pattern as every other deadline in this codebase (#A11). Unlike the SMC/Board `Deadline` model
// (admin-configured, one row per meeting), this cadence is fixed by the client's own spec, so it is
// a pure function of "now," not a database row.
export interface ReportingWeek {
  /** Monday 00:00 PGT of the reporting week. */
  weekStart: Date;
  /** The instant the normal reporting window closes: Friday 17:00 PGT. */
  deadlineAt: Date;
  /** Sunday 23:59:59.999 PGT — the outer edge of the week, used for late-submission routing. */
  weekEnd: Date;
  /** Stable code for ReportingPeriod, e.g. "WK-2026-35". */
  code: string;
  label: string;
}

/** The reporting week containing `referenceDate` (defaults to now), in Pacific/Port_Moresby. */
export function getReportingWeekFor(referenceDate: Date = new Date()): ReportingWeek {
  const pgt = DateTime.fromJSDate(referenceDate).setZone('Pacific/Port_Moresby');
  const monday = pgt.startOf('week'); // luxon weeks start Monday
  const deadline = monday.plus({ days: 4 }).set({ hour: 17, minute: 0, second: 0, millisecond: 0 });
  const weekEnd = monday.plus({ days: 6 }).endOf('day');
  const weekNumber = monday.weekNumber;

  return {
    weekStart: monday.toJSDate(),
    deadlineAt: deadline.toJSDate(),
    weekEnd: weekEnd.toJSDate(),
    code: `WK-${monday.year}-${String(weekNumber).padStart(2, '0')}`,
    label: `Week of ${monday.toFormat('d LLL yyyy')}`,
  };
}

/** Whether `asOf` (defaults to now) is past that reporting week's Friday-5pm-PGT deadline. */
export function isPastWeeklyDeadline(week: ReportingWeek, asOf: Date = new Date()): boolean {
  return asOf.getTime() > week.deadlineAt.getTime();
}
