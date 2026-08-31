import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole } from '@/lib/auth/rbac';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import { computeStatusForPercent, type DepartmentRiskStatus } from '@/lib/performance/riskService';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { Milestone } from '@prisma/client';

const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;
const DIRECTOR_ROLES = ['SUBMITTER', 'SYSTEM_ADMIN'] as const;

export class MilestoneValidationError extends Error {}

// Submitted -> Awaiting CEO Validation -> Validated | Returned for Clarification -> (Director
// resubmits) Awaiting CEO Validation — the client's exact 4-value CEO validation vocabulary.
// Director progress updates land on AWAITING_CEO_VALIDATION directly (not a separate "submitted"
// review queue) so a Director update never silently changes official performance until the CEO
// acts, per the client's explicit "Director updates must not immediately change official
// organisational performance."
export const MILESTONE_VALIDATION_STATES = [
  'SUBMITTED',
  'AWAITING_CEO_VALIDATION',
  'VALIDATED',
  'RETURNED_FOR_CLARIFICATION',
] as const;
export type MilestoneValidationState = (typeof MILESTONE_VALIDATION_STATES)[number];

export interface CreateMilestoneInput {
  title: string;
  description?: string;
  departmentId: string;
  responsibleDirectorId: string;
  targetDescription: string;
  startDate?: Date;
  dueDate: Date;
}

export async function createMilestone(
  input: CreateMilestoneInput,
  actingUser: AuthenticatedUser,
): Promise<Milestone> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (!input.title.trim()) throw new MilestoneValidationError('Enter a title.');
  if (!input.targetDescription.trim()) throw new MilestoneValidationError('Enter the target.');

  const year = new Date().getFullYear().toString();
  const referenceNumber = await nextReferenceNumber('MS', year);

  const milestone = await prisma.milestone.create({
    data: {
      referenceNumber,
      title: input.title,
      description: input.description,
      departmentId: input.departmentId,
      responsibleDirectorId: input.responsibleDirectorId,
      targetDescription: input.targetDescription,
      startDate: input.startDate,
      dueDate: input.dueDate,
      createdById: actingUser.id,
      validationStatus: 'SUBMITTED',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'MILESTONE_CREATED',
    entityType: 'Milestone',
    entityId: milestone.id,
    newState: { referenceNumber, dueDate: input.dueDate, targetDescription: input.targetDescription },
    correlationRef: referenceNumber,
  });

  await getNotificationProvider().notify({
    userId: input.responsibleDirectorId,
    type: 'MILESTONE_ASSIGNED',
    message: `New milestone ${referenceNumber}: "${input.title}" — due ${input.dueDate.toLocaleDateString()}.`,
    linkUrl: `/executive-dashboard/performance/milestones/${milestone.id}`,
  });

  return milestone;
}

/**
 * Approved-target changes (due date / target description, once a milestone has left initial
 * DRAFT-equivalent creation) require reason/authority/previous/new/user/timestamp/audit record —
 * satisfied by recording an AuditEvent (userId = authority, previousState/newState = previous/new,
 * createdAt = timestamp) rather than a new audit model, reusing the existing append-only mechanism
 * (#A6/#A27 precedent) instead of duplicating it.
 */
export async function changeMilestoneTarget(
  milestoneId: string,
  actingUser: AuthenticatedUser,
  changes: { targetDescription?: string; dueDate?: Date },
  reason: string,
): Promise<Milestone> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (!reason.trim()) {
    throw new MilestoneValidationError('A reason is required to change an approved target.');
  }
  const milestone = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } });

  const previous = {
    targetDescription: milestone.targetDescription,
    dueDate: milestone.dueDate,
  };
  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      targetDescription: changes.targetDescription ?? milestone.targetDescription,
      dueDate: changes.dueDate ?? milestone.dueDate,
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'MILESTONE_TARGET_CHANGED',
    entityType: 'Milestone',
    entityId: milestoneId,
    previousState: previous,
    newState: {
      targetDescription: updated.targetDescription,
      dueDate: updated.dueDate,
      reason,
    },
    correlationRef: milestone.referenceNumber,
  });

  return updated;
}

/** Director progress update — moves straight to AWAITING_CEO_VALIDATION; never sets VALIDATED
 * itself, so an update can never silently become "official" without a CEO action. */
export async function submitMilestoneProgress(
  milestoneId: string,
  actingUser: AuthenticatedUser,
  input: { progressPercent: number; directorComment?: string },
): Promise<Milestone> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const milestone = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } });
  if (milestone.responsibleDirectorId !== actingUser.id && actingUser.roles.every((r) => r.roleCode !== 'SYSTEM_ADMIN')) {
    throw new MilestoneValidationError('Only the responsible Director may update this milestone.');
  }

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      progressPercent: Math.max(0, Math.min(100, input.progressPercent)),
      directorComment: input.directorComment,
      validationStatus: 'AWAITING_CEO_VALIDATION',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'MILESTONE_PROGRESS_SUBMITTED',
    entityType: 'Milestone',
    entityId: milestoneId,
    newState: { progressPercent: updated.progressPercent },
    correlationRef: milestone.referenceNumber,
  });

  await getNotificationProvider().notify({
    userId: milestone.createdById,
    type: 'MILESTONE_PROGRESS_SUBMITTED',
    message: `Progress update on milestone ${milestone.referenceNumber} awaiting your validation.`,
    linkUrl: `/executive-dashboard/performance/milestones/${milestone.id}`,
  });

  return updated;
}

async function ceoDecide(
  milestoneId: string,
  actingUser: AuthenticatedUser,
  toState: 'VALIDATED' | 'RETURNED_FOR_CLARIFICATION',
  ceoComment: string | undefined,
  requireComment: boolean,
): Promise<Milestone> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (requireComment && !ceoComment?.trim()) {
    throw new MilestoneValidationError('A comment is required to return a milestone for clarification.');
  }
  const milestone = await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } });

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: { validationStatus: toState, ceoComment },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: `MILESTONE_${toState}`,
    entityType: 'Milestone',
    entityId: milestoneId,
    previousState: { validationStatus: milestone.validationStatus },
    newState: { validationStatus: toState, ceoComment },
    correlationRef: milestone.referenceNumber,
  });

  await getNotificationProvider().notify({
    userId: milestone.responsibleDirectorId,
    type: `MILESTONE_${toState}`,
    message:
      toState === 'VALIDATED'
        ? `Milestone ${milestone.referenceNumber} progress was validated by the CEO.`
        : `Milestone ${milestone.referenceNumber} was returned for clarification: ${ceoComment}`,
    linkUrl: `/executive-dashboard/performance/milestones/${milestone.id}`,
  });

  return updated;
}

export const validateMilestone = (
  milestoneId: string,
  actingUser: AuthenticatedUser,
  ceoComment?: string,
) => ceoDecide(milestoneId, actingUser, 'VALIDATED', ceoComment, false);

export const returnMilestoneForClarification = (
  milestoneId: string,
  actingUser: AuthenticatedUser,
  ceoComment: string,
) => ceoDecide(milestoneId, actingUser, 'RETURNED_FOR_CLARIFICATION', ceoComment, true);

export interface MilestoneRow {
  id: string;
  referenceNumber: string;
  title: string;
  departmentName: string;
  responsibleDirectorName: string;
  dueDate: Date;
  progressPercent: number;
  validationStatus: string;
  status: DepartmentRiskStatus;
}

export async function listMilestonesForUser(actingUser: AuthenticatedUser): Promise<MilestoneRow[]> {
  const isDirector = actingUser.roles.some((r) => r.roleCode === 'SUBMITTER');
  const isCeo = actingUser.roles.some(
    (r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isDirector && !isCeo) {
    throw new MilestoneValidationError('No access to milestones.');
  }

  const rows = await prisma.milestone.findMany({
    where: isCeo ? {} : { responsibleDirectorId: actingUser.id },
    include: { department: true, responsibleDirector: true },
    orderBy: { dueDate: 'asc' },
  });

  return rows.map((m) => ({
    id: m.id,
    referenceNumber: m.referenceNumber,
    title: m.title,
    departmentName: m.department.name,
    responsibleDirectorName: m.responsibleDirector.name,
    dueDate: m.dueDate,
    progressPercent: m.progressPercent,
    validationStatus: m.validationStatus,
    status: milestoneRiskStatus(m),
  }));
}

export function milestoneRiskStatus(m: Pick<Milestone, 'progressPercent' | 'dueDate'>): DepartmentRiskStatus {
  const overdue = m.dueDate < new Date();
  if (overdue && m.progressPercent < 100) return 'CRITICAL';
  return computeStatusForPercent(m.progressPercent);
}

export async function getMilestoneForUser(milestoneId: string, actingUser: AuthenticatedUser) {
  const milestone = await prisma.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      department: true,
      responsibleDirector: true,
      evidence: true,
    },
  });
  if (!milestone) return null;
  const isCeo = actingUser.roles.some(
    (r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isCeo && milestone.responsibleDirectorId !== actingUser.id) {
    throw new MilestoneValidationError('No access to this milestone.');
  }
  return milestone;
}
