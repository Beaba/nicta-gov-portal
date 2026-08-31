import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import type { WeeklyManagerReport } from '@prisma/client';

// The client's exact 8-value Weekly Manager Report status vocabulary. Same table-driven-graph
// pattern as every other workflow module in this codebase (submissions/workflow.ts,
// delegations/workflow.ts, board/meetings.ts, board/resolutions.ts) — see
// docs/assumptions-and-decisions.md#A32 for why this pass still doesn't extract a shared engine.
export const WEEKLY_REPORT_STATES = [
  'DRAFT',
  'SUBMITTED',
  'LATE',
  'UNDER_DIRECTOR_REVIEW',
  'RETURNED_FOR_CLARIFICATION',
  'VALIDATED_BY_DIRECTOR',
  'INCLUDED_IN_DIRECTOR_SUMMARY',
  'CLOSED',
] as const;
export type WeeklyReportState = (typeof WEEKLY_REPORT_STATES)[number];

const TRANSITIONS: Record<WeeklyReportState, WeeklyReportState[]> = {
  DRAFT: ['SUBMITTED', 'LATE'],
  SUBMITTED: ['UNDER_DIRECTOR_REVIEW'],
  LATE: ['UNDER_DIRECTOR_REVIEW'],
  UNDER_DIRECTOR_REVIEW: ['RETURNED_FOR_CLARIFICATION', 'VALIDATED_BY_DIRECTOR'],
  RETURNED_FOR_CLARIFICATION: ['SUBMITTED', 'LATE'],
  VALIDATED_BY_DIRECTOR: ['INCLUDED_IN_DIRECTOR_SUMMARY'],
  INCLUDED_IN_DIRECTOR_SUMMARY: ['CLOSED'],
  CLOSED: [],
};

export class InvalidWeeklyReportTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Invalid weekly report transition: ${from} -> ${to}`);
    this.name = 'InvalidWeeklyReportTransitionError';
  }
}

export function isValidWeeklyReportTransition(from: string, to: WeeklyReportState): boolean {
  return Boolean(TRANSITIONS[from as WeeklyReportState]?.includes(to));
}

export async function transitionWeeklyReport(params: {
  report: WeeklyManagerReport;
  toState: WeeklyReportState;
  performedById: string;
  comment?: string;
}): Promise<WeeklyManagerReport> {
  const { report, toState, performedById, comment } = params;
  const fromState = report.status as WeeklyReportState;

  if (!isValidWeeklyReportTransition(fromState, toState)) {
    throw new InvalidWeeklyReportTransitionError(fromState, toState);
  }

  const updated = await prisma.weeklyManagerReport.update({
    where: { id: report.id },
    data: { status: toState },
  });

  await prisma.workflowTransition.create({
    data: {
      entityType: 'WeeklyManagerReport',
      fromState,
      toState,
      performedById,
      comment,
    },
  });

  await recordAuditEvent({
    userId: performedById,
    action: 'WEEKLY_REPORT_TRANSITION',
    entityType: 'WeeklyManagerReport',
    entityId: report.id,
    previousState: { status: fromState },
    newState: { status: toState },
    correlationRef: report.referenceNumber,
  });

  return updated;
}
