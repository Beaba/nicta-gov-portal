import { prisma } from '@/lib/db/prisma';
import { isOverdue as isDelegationOverdue } from '@/lib/delegations/workflow';
import { requireAnyRole } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';

const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;

export type CriticalTaskSource = 'DELEGATION' | 'BOARD_ACTION';

export interface CriticalTask {
  id: string;
  source: CriticalTaskSource;
  title: string;
  departmentName: string | null;
  responsibleName: string | null;
  dueDate: Date | null;
  status: string;
  progressNote: string | null;
  escalationReason: string;
  linkUrl: string;
}

/**
 * #A31's "Critical Tasks & Escalations" — deliberately not a new model. Every field the client's
 * spec asks for (responsible Director/department, due date, risk status, progress, escalation
 * reason) already exists on either Delegation (#A29) or the Board ActionItem (#A30); this just
 * aggregates the overdue/at-risk rows from both into one CEO-facing list, reusing exactly the
 * "no duplicate models where reusable ones already exist" instruction.
 */
export async function listCriticalTasks(actingUser: AuthenticatedUser): Promise<CriticalTask[]> {
  requireAnyRole(actingUser, CEO_ROLES);

  const [delegations, actionItems] = await Promise.all([
    prisma.delegation.findMany({
      where: { status: { notIn: ['COMPLETED', 'CLOSED', 'CANCELLED', 'DRAFT'] } },
      include: { responsibleDirector: true, supportingDepartment: true },
    }),
    prisma.actionItem.findMany({
      where: {
        sourceMeetingId: { not: null },
        status: { in: ['AT_RISK', 'OVERDUE'] },
      },
      include: { department: true, sourceMeeting: true },
    }),
  ]);

  const fromDelegations: CriticalTask[] = delegations
    .filter((d) => d.status === 'AT_RISK' || isDelegationOverdue(d))
    .map((d) => ({
      id: d.id,
      source: 'DELEGATION',
      title: d.title,
      departmentName: d.supportingDepartment?.name ?? null,
      responsibleName: d.responsibleDirector.name,
      dueDate: d.dueDate,
      status: d.status,
      progressNote: null,
      escalationReason:
        d.status === 'AT_RISK'
          ? 'Flagged at risk by the responsible Director'
          : 'Past its due date without completion',
      linkUrl: `/delegations/${d.id}`,
    }));

  const fromActions: CriticalTask[] = actionItems.map((a) => ({
    id: a.id,
    source: 'BOARD_ACTION',
    title: a.description,
    departmentName: a.department?.name ?? null,
    responsibleName: null,
    dueDate: a.dueDate,
    status: a.status,
    progressNote: a.progressUpdate,
    escalationReason:
      a.status === 'OVERDUE' ? 'Board action past its due date' : 'Board action flagged at risk',
    linkUrl: `/board/actions`,
  }));

  return [...fromDelegations, ...fromActions].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
}
