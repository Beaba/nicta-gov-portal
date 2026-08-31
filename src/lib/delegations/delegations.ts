import { prisma } from '@/lib/db/prisma';
import {
  transitionDelegation,
  recordDelegationNote,
  type DelegationState,
} from '@/lib/delegations/workflow';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { requireAnyRole, AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { Delegation, DelegationPriority, ConfidentialityLevel } from '@prisma/client';

export class DelegationValidationError extends Error {}

// Only the CEO issues/decides on delegations; only the responsible Director (or SYSTEM_ADMIN, the
// same emergency-override precedent as review.ts's CEO_ROLES/REVIEWER_ROLES) acts on their own
// side — see docs/assumptions-and-decisions.md#A29 for why this is CEO->Director only, not a
// general delegation-chain feature.
const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;
const DIRECTOR_ROLES = ['SUBMITTER', 'SYSTEM_ADMIN'] as const;

function assertIsResponsibleDirector(delegation: Delegation, actingUser: AuthenticatedUser): void {
  if (actingUser.roles.some((r) => r.roleCode === 'SYSTEM_ADMIN')) return;
  if (delegation.responsibleDirectorId !== actingUser.id) {
    throw new AuthorizationError('Only the responsible Director may act on this delegation');
  }
}

export interface CreateDelegationInput {
  title: string;
  description: string;
  responsibleDirectorId: string;
  supportingDepartmentId?: string;
  supportingManagerId?: string;
  priority?: DelegationPriority;
  startDate: Date;
  dueDate: Date;
  expectedOutcome: string;
  requiredEvidence?: string;
  confidentiality?: ConfidentialityLevel;
  // #A32 — one of DELEGATION_CATEGORIES; additional accountable-lead-adjacent Directors/a Manager
  // the CEO assigns directly (the responsible Director stays automatically notified — see
  // addDelegationRecipients below).
  category?: string;
  completionRequirement?: 'EVIDENCE' | 'ACKNOWLEDGEMENT_ONLY';
  additionalRecipientUserIds?: string[];
}

export async function createDelegation(
  input: CreateDelegationInput,
  actingUser: AuthenticatedUser,
): Promise<Delegation> {
  requireAnyRole(actingUser, CEO_ROLES);

  if (!input.title.trim()) throw new DelegationValidationError('Enter a title.');
  if (!input.description.trim()) throw new DelegationValidationError('Enter a description.');
  if (!input.expectedOutcome.trim())
    throw new DelegationValidationError('Enter the expected outcome.');
  if (input.dueDate < input.startDate) {
    throw new DelegationValidationError('Due date cannot be before the start date.');
  }

  const director = await prisma.user.findUnique({ where: { id: input.responsibleDirectorId } });
  if (!director || !director.isActive) {
    throw new DelegationValidationError('Select an active Director to delegate to.');
  }

  const year = new Date().getFullYear().toString();
  const referenceNumber = await nextReferenceNumber('DEL', year);

  const delegation = await prisma.delegation.create({
    data: {
      referenceNumber,
      title: input.title,
      description: input.description,
      responsibleDirectorId: input.responsibleDirectorId,
      supportingDepartmentId: input.supportingDepartmentId,
      supportingManagerId: input.supportingManagerId,
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
      expectedOutcome: input.expectedOutcome,
      requiredEvidence: input.requiredEvidence,
      confidentiality: input.confidentiality,
      category: input.category,
      completionRequirement: input.completionRequirement ?? 'EVIDENCE',
      createdById: actingUser.id,
      status: 'DRAFT',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'DELEGATION_CREATED',
    entityType: 'Delegation',
    entityId: delegation.id,
    newState: { referenceNumber, responsibleDirectorId: input.responsibleDirectorId },
    correlationRef: referenceNumber,
  });

  // #A32 — "several Directors with one accountable lead" / "a Manager, with the responsible
  // Director automatically notified": additional recipients beyond responsibleDirectorId (the
  // accountable lead) are notified rows, not independent state-machine actors — see
  // DelegationRecipient's schema comment.
  const additional = input.additionalRecipientUserIds ?? [];
  if (input.supportingManagerId) additional.push(input.supportingManagerId);
  for (const userId of new Set(additional)) {
    if (userId === input.responsibleDirectorId) continue;
    await prisma.delegationRecipient.create({
      data: { delegationId: delegation.id, userId, addedById: actingUser.id },
    });
  }

  return delegation;
}

/** Notifies every additional recipient once the delegation is issued (mirrors issueDelegation's
 * own notification to the accountable lead) — kept separate so createDelegation stays a pure
 * DRAFT-only write, matching the existing Draft->Issued split (NewDelegationModal's own comment). */
export async function notifyDelegationRecipients(delegationId: string): Promise<void> {
  const delegation = await prisma.delegation.findUniqueOrThrow({
    where: { id: delegationId },
    include: { recipients: true },
  });
  await Promise.all(
    delegation.recipients.map((r) =>
      getNotificationProvider().notify({
        userId: r.userId,
        type: 'DELEGATION_RECIPIENT_NOTIFIED',
        message: `You were named on CEO delegation ${delegation.referenceNumber}: "${delegation.title}" (accountable lead: see delegation).`,
        linkUrl: `/delegations/${delegation.id}`,
      }),
    ),
  );
}

/** Director's "Nominate an Alternate" — records the nomination as a note (comment logged on the
 * transition timeline) rather than reassigning `responsibleDirectorId`, since the CEO must confirm
 * an alternate before the accountable lead actually changes; that confirmation is a separate,
 * explicit CEO action (extendDelegationDueDate-style small write) left for the CEO to action from
 * the notification this raises, not automatic. */
export async function nominateDelegationAlternate(
  delegationId: string,
  actingUser: AuthenticatedUser,
  alternateUserId: string,
  comment: string,
): Promise<void> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  if (!comment.trim()) {
    throw new DelegationValidationError('Explain why an alternate is being nominated.');
  }
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);
  const alternate = await prisma.user.findUnique({ where: { id: alternateUserId } });
  if (!alternate) throw new DelegationValidationError('Select a valid alternate.');

  await recordDelegationNote({
    delegation,
    performedById: actingUser.id,
    action: 'DELEGATION_ALTERNATE_NOMINATED',
    comment: `Nominated ${alternate.name} as an alternate: ${comment}`,
  });

  await getNotificationProvider().notify({
    userId: delegation.createdById,
    type: 'DELEGATION_ALTERNATE_NOMINATED',
    message: `${actingUser.name} nominated ${alternate.name} as an alternate for ${delegation.referenceNumber}: ${comment}`,
    linkUrl: `/delegations/${delegation.id}`,
  });
}

/** Director's "Assign to Manager" — adds the Manager as a DelegationRecipient (notified,
 * visible), keeping the Director as accountable lead throughout, per the client's own "a Director
 * who subsequently assigns to a Manager" description (the Director stays responsible; the Manager
 * becomes a working recipient, not a new accountable lead). */
export async function assignDelegationToManager(
  delegationId: string,
  actingUser: AuthenticatedUser,
  managerId: string,
  comment?: string,
): Promise<void> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);
  const manager = await prisma.user.findUnique({ where: { id: managerId } });
  if (!manager) throw new DelegationValidationError('Select a valid Manager.');

  await prisma.delegationRecipient.upsert({
    where: { delegationId_userId: { delegationId, userId: managerId } },
    update: {},
    create: { delegationId, userId: managerId, recipientRole: 'MANAGER', addedById: actingUser.id },
  });

  await recordDelegationNote({
    delegation,
    performedById: actingUser.id,
    action: 'DELEGATION_ASSIGNED_TO_MANAGER',
    comment: `Assigned to Manager ${manager.name} for execution.${comment ? ` ${comment}` : ''}`,
  });

  await getNotificationProvider().notify({
    userId: managerId,
    type: 'DELEGATION_ASSIGNED_TO_MANAGER',
    message: `${actingUser.name} assigned you to work on delegation ${delegation.referenceNumber}: "${delegation.title}".`,
    linkUrl: `/delegations/${delegation.id}`,
  });
}

async function requireDelegation(delegationId: string): Promise<Delegation> {
  return prisma.delegation.findUniqueOrThrow({ where: { id: delegationId } });
}

export async function issueDelegation(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment?: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, CEO_ROLES);
  const delegation = await requireDelegation(delegationId);
  const updated = await transitionDelegation({
    delegation,
    toState: 'ISSUED',
    performedById: actingUser.id,
    comment,
    extraData: { issuedAt: new Date() },
  });

  await getNotificationProvider().notify({
    userId: delegation.responsibleDirectorId,
    type: 'DELEGATION_ISSUED',
    message: `New CEO delegation ${delegation.referenceNumber}: "${delegation.title}" — due ${delegation.dueDate.toLocaleDateString()}.`,
    linkUrl: `/delegations/${delegation.id}`,
  });

  return updated;
}

export async function acknowledgeDelegation(
  delegationId: string,
  actingUser: AuthenticatedUser,
): Promise<Delegation> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);
  return transitionDelegation({
    delegation,
    toState: 'ACKNOWLEDGED',
    performedById: actingUser.id,
    extraData: { acknowledgedAt: new Date() },
  });
}

export async function startDelegationWork(
  delegationId: string,
  actingUser: AuthenticatedUser,
): Promise<Delegation> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);
  return transitionDelegation({ delegation, toState: 'IN_PROGRESS', performedById: actingUser.id });
}

export async function flagDelegationRisk(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  if (!comment.trim()) {
    throw new DelegationValidationError('Describe the risk when flagging a delegation at risk.');
  }
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);
  const updated = await transitionDelegation({
    delegation,
    toState: 'AT_RISK',
    performedById: actingUser.id,
    comment,
  });

  await getNotificationProvider().notify({
    userId: delegation.createdById,
    type: 'DELEGATION_AT_RISK',
    message: `${delegation.referenceNumber} "${delegation.title}" was flagged at risk: ${comment}`,
    linkUrl: `/delegations/${delegation.id}`,
  });

  return updated;
}

export async function clearDelegationRisk(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment?: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);
  return transitionDelegation({
    delegation,
    toState: 'IN_PROGRESS',
    performedById: actingUser.id,
    comment,
  });
}

export async function submitDelegationForReview(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment?: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);

  // #A32 — "A completed delegation must include evidence, comments or a report" /
  // Delegation.completionRequirement ("Completion requires: Evidence or Report |
  // Acknowledgement Only"). Checked here (submission for CEO review), not on completeDelegation
  // itself, since completion is the CEO's own action — the Director-side gate is what stops an
  // empty submission from ever reaching the CEO.
  if (delegation.completionRequirement === 'EVIDENCE') {
    const evidenceCount = await prisma.evidence.count({ where: { delegationId } });
    if (evidenceCount === 0 && !comment?.trim()) {
      throw new DelegationValidationError(
        'This delegation requires evidence or a report before it can be submitted for review.',
      );
    }
  }

  const updated = await transitionDelegation({
    delegation,
    toState: 'SUBMITTED_FOR_REVIEW',
    performedById: actingUser.id,
    comment,
  });

  await getNotificationProvider().notify({
    userId: delegation.createdById,
    type: 'DELEGATION_SUBMITTED_FOR_REVIEW',
    message: `${delegation.referenceNumber} "${delegation.title}" was submitted for your review.`,
    linkUrl: `/delegations/${delegation.id}`,
  });

  return updated;
}

export async function resumeDelegationWork(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment?: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);
  return transitionDelegation({
    delegation,
    toState: 'IN_PROGRESS',
    performedById: actingUser.id,
    comment,
  });
}

export async function returnDelegationForMoreWork(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (!comment.trim()) {
    throw new DelegationValidationError('A comment is required when returning a delegation.');
  }
  const delegation = await requireDelegation(delegationId);
  const updated = await transitionDelegation({
    delegation,
    toState: 'RETURNED_FOR_MORE_WORK',
    performedById: actingUser.id,
    comment,
  });

  await getNotificationProvider().notify({
    userId: delegation.responsibleDirectorId,
    type: 'DELEGATION_RETURNED',
    message: `${delegation.referenceNumber} "${delegation.title}" was returned for more work: ${comment}`,
    linkUrl: `/delegations/${delegation.id}`,
  });

  return updated;
}

export async function completeDelegation(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment?: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, CEO_ROLES);
  const delegation = await requireDelegation(delegationId);
  const updated = await transitionDelegation({
    delegation,
    toState: 'COMPLETED',
    performedById: actingUser.id,
    comment,
  });

  await getNotificationProvider().notify({
    userId: delegation.responsibleDirectorId,
    type: 'DELEGATION_COMPLETED',
    message: `${delegation.referenceNumber} "${delegation.title}" was marked completed by the CEO.`,
    linkUrl: `/delegations/${delegation.id}`,
  });

  return updated;
}

export async function closeDelegation(
  delegationId: string,
  actingUser: AuthenticatedUser,
  closureDecision: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (!closureDecision.trim()) {
    throw new DelegationValidationError('A closure decision is required to close a delegation.');
  }
  const delegation = await requireDelegation(delegationId);
  return transitionDelegation({
    delegation,
    toState: 'CLOSED',
    performedById: actingUser.id,
    comment: closureDecision,
    extraData: { closureDecision, closedAt: new Date() },
  });
}

export async function cancelDelegation(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (!comment.trim()) {
    throw new DelegationValidationError('A comment is required when cancelling a delegation.');
  }
  const delegation = await requireDelegation(delegationId);
  const updated = await transitionDelegation({
    delegation,
    toState: 'CANCELLED',
    performedById: actingUser.id,
    comment,
  });

  await getNotificationProvider().notify({
    userId: delegation.responsibleDirectorId,
    type: 'DELEGATION_CANCELLED',
    message: `${delegation.referenceNumber} "${delegation.title}" was cancelled: ${comment}`,
    linkUrl: `/delegations/${delegation.id}`,
  });

  return updated;
}

export async function extendDelegationDueDate(
  delegationId: string,
  actingUser: AuthenticatedUser,
  newDueDate: Date,
  comment?: string,
): Promise<Delegation> {
  requireAnyRole(actingUser, CEO_ROLES);
  const delegation = await requireDelegation(delegationId);
  const previousDueDate = delegation.dueDate;
  const updated = await prisma.delegation.update({
    where: { id: delegation.id },
    data: { dueDate: newDueDate },
  });

  await recordDelegationNote({
    delegation: updated,
    performedById: actingUser.id,
    action: 'DELEGATION_EXTENDED',
    comment: `Due date extended from ${previousDueDate.toLocaleDateString()} to ${newDueDate.toLocaleDateString()}.${comment ? ` ${comment}` : ''}`,
  });

  await getNotificationProvider().notify({
    userId: delegation.responsibleDirectorId,
    type: 'DELEGATION_EXTENDED',
    message: `${delegation.referenceNumber} "${delegation.title}" due date extended to ${newDueDate.toLocaleDateString()}.`,
    linkUrl: `/delegations/${delegation.id}`,
  });

  return updated;
}

export async function requestDelegationExtension(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<void> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  if (!comment.trim()) {
    throw new DelegationValidationError('Explain why an extension is needed.');
  }
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);

  await recordDelegationNote({
    delegation,
    performedById: actingUser.id,
    action: 'DELEGATION_EXTENSION_REQUESTED',
    comment,
  });

  await getNotificationProvider().notify({
    userId: delegation.createdById,
    type: 'DELEGATION_EXTENSION_REQUESTED',
    message: `${delegation.referenceNumber} "${delegation.title}": Director requested an extension — ${comment}`,
    linkUrl: `/delegations/${delegation.id}`,
  });
}

export async function addDelegationUpdate(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<void> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  if (!comment.trim()) {
    throw new DelegationValidationError('Enter a progress update.');
  }
  const delegation = await requireDelegation(delegationId);
  assertIsResponsibleDirector(delegation, actingUser);

  await recordDelegationNote({
    delegation,
    performedById: actingUser.id,
    action: 'DELEGATION_UPDATE_ADDED',
    comment,
  });
}

export async function addCeoComment(
  delegationId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<void> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (!comment.trim()) {
    throw new DelegationValidationError('Enter a comment.');
  }
  const delegation = await requireDelegation(delegationId);

  await recordDelegationNote({
    delegation,
    performedById: actingUser.id,
    action: 'DELEGATION_CEO_COMMENT',
    comment,
  });

  await getNotificationProvider().notify({
    userId: delegation.responsibleDirectorId,
    type: 'DELEGATION_CEO_COMMENT',
    message: `CEO commented on ${delegation.referenceNumber} "${delegation.title}": ${comment}`,
    linkUrl: `/delegations/${delegation.id}`,
  });
}

export async function listDelegationsForCeo(actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, CEO_ROLES);
  return prisma.delegation.findMany({
    include: { responsibleDirector: true, supportingDepartment: true },
    orderBy: [{ dueDate: 'asc' }],
  });
}

export async function listDelegationsForDirector(actingUser: AuthenticatedUser) {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  return prisma.delegation.findMany({
    where: { responsibleDirectorId: actingUser.id },
    include: { responsibleDirector: true, supportingDepartment: true, createdBy: true },
    orderBy: [{ dueDate: 'asc' }],
  });
}

export async function getDelegationForUser(delegationId: string, actingUser: AuthenticatedUser) {
  const delegation = await prisma.delegation.findUnique({
    where: { id: delegationId },
    include: {
      responsibleDirector: true,
      supportingDepartment: true,
      supportingManager: true,
      createdBy: true,
      transitions: { orderBy: { performedAt: 'asc' } },
      evidence: true,
    },
  });
  if (!delegation) return null;

  const isCeo = actingUser.roles.some((r) => (CEO_ROLES as readonly string[]).includes(r.roleCode));
  const isOwnDirector = delegation.responsibleDirectorId === actingUser.id;
  if (!isCeo && !isOwnDirector) {
    throw new AuthorizationError('No access to this delegation');
  }

  return delegation;
}

export type { DelegationState };
