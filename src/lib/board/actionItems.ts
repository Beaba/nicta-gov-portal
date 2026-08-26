import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole } from '@/lib/auth/rbac';
import { BOARD_SECRETARIAT_ROLES, BOARD_ANY_ROLES } from '@/lib/board/roles';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { ActionItemStatus } from '@prisma/client';

export class BoardActionValidationError extends Error {}

// The client's exact 6-value set for Board actions — see schema.prisma's ActionItemStatus comment
// for why OPEN/DONE (the pre-existing values) are kept but unused by this module.
export const BOARD_ACTION_STATUSES: ActionItemStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'AT_RISK',
  'OVERDUE',
  'COMPLETED',
  'CLOSED',
];

const TRANSITIONS: Record<string, ActionItemStatus[]> = {
  NOT_STARTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['AT_RISK', 'COMPLETED'],
  AT_RISK: ['IN_PROGRESS', 'COMPLETED'],
  OVERDUE: ['IN_PROGRESS', 'COMPLETED'],
  COMPLETED: ['CLOSED'],
  CLOSED: [],
};

export interface CreateBoardActionInput {
  description: string;
  ownerId?: string;
  departmentId?: string;
  sourceMeetingId?: string;
  resolutionId?: string;
  dueDate?: Date;
}

export async function createBoardActionItem(
  input: CreateBoardActionInput,
  actingUser: AuthenticatedUser,
) {
  requireAnyRole(actingUser, BOARD_SECRETARIAT_ROLES);
  if (!input.description.trim()) throw new BoardActionValidationError('Enter a description.');

  const action = await prisma.actionItem.create({
    data: {
      description: input.description,
      ownerId: input.ownerId,
      departmentId: input.departmentId,
      sourceMeetingId: input.sourceMeetingId,
      resolutionId: input.resolutionId,
      dueDate: input.dueDate,
      createdById: actingUser.id,
      status: 'NOT_STARTED',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_ACTION_CREATED',
    entityType: 'ActionItem',
    entityId: action.id,
    newState: { description: input.description },
  });

  if (input.ownerId) {
    await getNotificationProvider().notify({
      userId: input.ownerId,
      type: 'BOARD_ACTION_ASSIGNED',
      message: `A Board action was assigned to you: "${input.description}"${input.dueDate ? ` — due ${input.dueDate.toLocaleDateString()}` : ''}.`,
      linkUrl: `/board/actions`,
    });
  }

  return action;
}

/** Owner-only update — `ownerId` is a plain string, not a session-role gate, since a Board action
 * owner is typically a Director rather than a Board Member/Secretariat; the same "owner or
 * Secretariat may act" boundary already established for Delegations (#A29). */
export async function updateBoardActionProgress(
  actionId: string,
  actingUser: AuthenticatedUser,
  input: { status?: ActionItemStatus; progressUpdate?: string; completionComment?: string },
): Promise<void> {
  const action = await prisma.actionItem.findUniqueOrThrow({ where: { id: actionId } });
  const isSecretariat = actingUser.roles.some((r) =>
    (BOARD_SECRETARIAT_ROLES as readonly string[]).includes(r.roleCode),
  );
  if (!isSecretariat && action.ownerId !== actingUser.id) {
    throw new BoardActionValidationError(
      'Only the action owner or Board Secretariat may update this.',
    );
  }

  const fromStatus = action.status;
  if (input.status && input.status !== fromStatus) {
    const allowed = TRANSITIONS[fromStatus] ?? [];
    if (!allowed.includes(input.status)) {
      throw new BoardActionValidationError(
        `Cannot move an action from ${fromStatus} to ${input.status}.`,
      );
    }
  }

  await prisma.actionItem.update({
    where: { id: actionId },
    data: {
      status: input.status ?? action.status,
      progressUpdate: input.progressUpdate ?? action.progressUpdate,
      completionComment: input.completionComment ?? action.completionComment,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'BOARD_ACTION_UPDATED',
    entityType: 'ActionItem',
    entityId: actionId,
    previousState: { status: fromStatus },
    newState: { status: input.status ?? fromStatus, progressUpdate: input.progressUpdate },
  });
}

export async function listBoardActionItems(actingUser: AuthenticatedUser, meetingId?: string) {
  requireAnyRole(actingUser, BOARD_ANY_ROLES);
  return prisma.actionItem.findMany({
    where: {
      sourceMeetingId: meetingId ?? { not: null },
    },
    include: { department: true, sourceMeeting: true, resolution: true },
    orderBy: { dueDate: 'asc' },
  });
}
