import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';
import { getNotificationProvider } from '@/lib/providers/notifications';
import { requireAnyRole } from '@/lib/auth/rbac';
import { nextReferenceNumber } from '@/lib/submissions/referenceNumber';
import { transitionMemo } from '@/lib/memos/workflow';
import { isCategoryWhatsAppEligible } from '@/lib/memos/categories';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { Memo } from '@prisma/client';

const CEO_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;
const DIRECTOR_ROLES = ['SUBMITTER', 'DIRECTOR', 'SYSTEM_ADMIN'] as const;
const CEO_OFFICE_ROLES = ['CEO_OFFICE', 'SYSTEM_ADMIN'] as const;

export class MemoValidationError extends Error {}

export interface CreateMemoInput {
  category: string;
  subject: string;
  departmentId: string;
  purpose: string;
  requestedDecision: string;
  background?: string;
  recommendation?: string;
  financialValue?: number;
  budgetCode?: string;
  costCentre?: string;
  delegationAuthority?: string;
  priority?: string;
  dueDate?: Date;
}

export async function createMemo(input: CreateMemoInput, actingUser: AuthenticatedUser): Promise<Memo> {
  requireAnyRole(actingUser, [...DIRECTOR_ROLES, ...CEO_OFFICE_ROLES]);
  if (!input.subject.trim()) throw new MemoValidationError('Enter a subject.');
  if (!input.purpose.trim()) throw new MemoValidationError('Enter the purpose.');
  if (!input.requestedDecision.trim()) throw new MemoValidationError('Enter the requested decision.');

  const year = new Date().getFullYear().toString();
  const referenceNumber = await nextReferenceNumber('MEMO', year);

  const memo = await prisma.memo.create({
    data: {
      referenceNumber,
      category: input.category,
      subject: input.subject,
      originatingDirectorId: actingUser.id,
      departmentId: input.departmentId,
      purpose: input.purpose,
      background: input.background,
      requestedDecision: input.requestedDecision,
      recommendation: input.recommendation,
      financialValue: input.financialValue,
      budgetCode: input.budgetCode,
      costCentre: input.costCentre,
      delegationAuthority: input.delegationAuthority,
      priority: input.priority ?? 'MEDIUM',
      dueDate: input.dueDate,
      createdById: actingUser.id,
      status: 'DRAFT',
    },
  });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'MEMO_CREATED',
    entityType: 'Memo',
    entityId: memo.id,
    newState: { referenceNumber, category: input.category },
    correlationRef: referenceNumber,
  });

  return memo;
}

export async function submitMemo(memoId: string, actingUser: AuthenticatedUser): Promise<Memo> {
  requireAnyRole(actingUser, [...DIRECTOR_ROLES, ...CEO_OFFICE_ROLES]);
  const memo = await prisma.memo.findUniqueOrThrow({ where: { id: memoId } });

  // Every memo lands in the CEO's queue (AWAITING_CEO_APPROVAL) once submitted. This pass does not
  // build a separate Director-level auto-approval path for sub-K50,000 items or a distinct
  // "supporting reviewer" actor — UNDER_REVIEW is passed through automatically rather than skipped
  // (MEMO_STATES/workflow.ts's transition graph only allows SUBMITTED -> UNDER_REVIEW, not
  // straight to AWAITING_CEO_APPROVAL, so both transitions are applied and both are visible in the
  // WorkflowTransition audit trail) — see docs/known-limitations.md. Originally this called
  // transitionMemo with an invalid SUBMITTED -> AWAITING_CEO_APPROVAL edge directly, which threw
  // and silently stranded every memo at SUBMITTED; fixed after a live Playwright check caught it
  // never reaching the CEO's inbox.
  const submitted = await transitionMemo({ memo, toState: 'SUBMITTED', performedById: actingUser.id });
  const underReview = await transitionMemo({ memo: submitted, toState: 'UNDER_REVIEW', performedById: actingUser.id });
  const routed = await transitionMemo({ memo: underReview, toState: 'AWAITING_CEO_APPROVAL', performedById: actingUser.id });

  await getNotificationProvider().notify({
    userId: actingUser.id,
    type: 'MEMO_SUBMITTED',
    message: `Memo ${memo.referenceNumber} submitted.`,
    linkUrl: `/executive-dashboard/approvals?selected=${memo.id}`,
  });

  return routed;
}

async function ceoDecide(
  memoId: string,
  actingUser: AuthenticatedUser,
  toState: 'RETURNED' | 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'REJECTED',
  comment: string | undefined,
  requireComment: boolean,
): Promise<Memo> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (requireComment && !comment?.trim()) {
    throw new MemoValidationError('A comment is required for this decision.');
  }
  const memo = await prisma.memo.findUniqueOrThrow({ where: { id: memoId } });
  if (memo.status !== 'AWAITING_CEO_APPROVAL') {
    throw new MemoValidationError('This memo is not currently awaiting CEO approval.');
  }

  const updated = await transitionMemo({ memo, toState, performedById: actingUser.id, comment });

  if (comment) {
    await prisma.comment.create({
      data: { entityType: 'Memo', entityId: memoId, authorId: actingUser.id, body: comment },
    });
  }

  await getNotificationProvider().notify({
    userId: memo.originatingDirectorId,
    type: `MEMO_${toState}`,
    message: `Memo ${memo.referenceNumber} "${memo.subject}": ${toState.replace(/_/g, ' ').toLowerCase()}.${comment ? ` ${comment}` : ''}`,
    linkUrl: `/executive-dashboard/approvals?selected=${memo.id}`,
  });

  return updated;
}

export const approveMemo = (id: string, u: AuthenticatedUser, comment?: string) =>
  ceoDecide(id, u, 'APPROVED', comment, false);
export const approveMemoWithConditions = (id: string, u: AuthenticatedUser, comment: string) =>
  ceoDecide(id, u, 'APPROVED_WITH_CONDITIONS', comment, true);
export const returnMemoWithComments = (id: string, u: AuthenticatedUser, comment: string) =>
  ceoDecide(id, u, 'RETURNED', comment, true);
export const rejectMemo = (id: string, u: AuthenticatedUser, comment: string) =>
  ceoDecide(id, u, 'REJECTED', comment, true);

/** "Request Further Information" doesn't change status (mirrors SEMC's preliminary-comment
 * pattern) — it's a comment that keeps the memo AWAITING_CEO_APPROVAL, logged so the Director
 * sees it and can respond without the item leaving the CEO's queue. */
export async function requestMemoMoreInformation(
  memoId: string,
  actingUser: AuthenticatedUser,
  comment: string,
): Promise<void> {
  requireAnyRole(actingUser, CEO_ROLES);
  if (!comment.trim()) throw new MemoValidationError('Enter what information is required.');
  const memo = await prisma.memo.findUniqueOrThrow({ where: { id: memoId } });

  await prisma.comment.create({
    data: { entityType: 'Memo', entityId: memoId, authorId: actingUser.id, body: comment },
  });
  await recordAuditEvent({
    userId: actingUser.id,
    action: 'MEMO_MORE_INFORMATION_REQUESTED',
    entityType: 'Memo',
    entityId: memoId,
    newState: { comment },
    correlationRef: memo.referenceNumber,
  });
  await getNotificationProvider().notify({
    userId: memo.originatingDirectorId,
    type: 'MEMO_MORE_INFORMATION_REQUESTED',
    message: `The CEO requested more information on memo ${memo.referenceNumber}: ${comment}`,
    linkUrl: `/executive-dashboard/approvals?selected=${memo.id}`,
  });
}

/**
 * "Delegate Review" — grants a CEO Office (EO/PA) user visibility and comment rights on this one
 * memo. Deliberately review-only: it does NOT grant approve/reject authority. The client's spec
 * says EO/PA "cannot approve or reject... unless a formal delegation exists" — this pass
 * implements the review-delegation half; extending it to actually grant decision authority is a
 * separate, larger authority-escalation feature this increment does not build (see
 * docs/assumptions-and-decisions.md#A32 and known-limitations.md).
 */
export async function delegateMemoReview(
  memoId: string,
  actingUser: AuthenticatedUser,
  delegatedReviewerId: string,
): Promise<Memo> {
  requireAnyRole(actingUser, CEO_ROLES);
  const memo = await prisma.memo.findUniqueOrThrow({ where: { id: memoId } });

  const updated = await prisma.memo.update({ where: { id: memoId }, data: { delegatedReviewerId } });

  await recordAuditEvent({
    userId: actingUser.id,
    action: 'MEMO_REVIEW_DELEGATED',
    entityType: 'Memo',
    entityId: memoId,
    newState: { delegatedReviewerId },
    correlationRef: memo.referenceNumber,
  });

  await getNotificationProvider().notify({
    userId: delegatedReviewerId,
    type: 'MEMO_REVIEW_DELEGATED',
    message: `The CEO delegated review (not approval) of memo ${memo.referenceNumber} "${memo.subject}" to you.`,
    linkUrl: `/executive-dashboard/office?selected=${memo.id}`,
  });

  return updated;
}

export async function withdrawMemo(memoId: string, actingUser: AuthenticatedUser): Promise<Memo> {
  requireAnyRole(actingUser, DIRECTOR_ROLES);
  const memo = await prisma.memo.findUniqueOrThrow({ where: { id: memoId } });
  if (memo.originatingDirectorId !== actingUser.id && actingUser.roles.every((r) => r.roleCode !== 'SYSTEM_ADMIN')) {
    throw new MemoValidationError('Only the originating Director may withdraw this memo.');
  }
  return transitionMemo({ memo, toState: 'WITHDRAWN', performedById: actingUser.id });
}

export interface MemoRow extends Memo {
  departmentName: string;
  originatingDirectorName: string;
  whatsappEligible: boolean;
}

/** The unified CEO Approval Inbox's Memo/BAU rows — see executive/approvalInbox.ts for the
 * combined inbox this feeds into alongside SMC/Board items. */
export async function listMemosForCeo(actingUser: AuthenticatedUser): Promise<MemoRow[]> {
  requireAnyRole(actingUser, CEO_ROLES);
  const rows = await prisma.memo.findMany({
    where: { status: { in: ['AWAITING_CEO_APPROVAL'] } },
    include: { department: true, originatingDirector: true },
    orderBy: { dueDate: 'asc' },
  });
  return rows.map((m) => ({
    ...m,
    departmentName: m.department.name,
    originatingDirectorName: m.originatingDirector.name,
    whatsappEligible: isCategoryWhatsAppEligible(m.category) && (!m.financialValue || Number(m.financialValue) <= 50000),
  }));
}

export async function listAllMemosForUser(actingUser: AuthenticatedUser) {
  const isCeo = actingUser.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN');
  const isCeoOffice = actingUser.roles.some((r) => r.roleCode === 'CEO_OFFICE');
  const isDirector = actingUser.roles.some((r) => r.roleCode === 'SUBMITTER');

  if (isCeo) {
    return prisma.memo.findMany({ include: { department: true, originatingDirector: true }, orderBy: { createdAt: 'desc' } });
  }
  if (isCeoOffice) {
    return prisma.memo.findMany({
      where: { delegatedReviewerId: actingUser.id },
      include: { department: true, originatingDirector: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  if (isDirector) {
    return prisma.memo.findMany({
      where: { originatingDirectorId: actingUser.id },
      include: { department: true, originatingDirector: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  throw new MemoValidationError('No access to memos.');
}

export async function getMemoForUser(memoId: string, actingUser: AuthenticatedUser) {
  const memo = await prisma.memo.findUnique({
    where: { id: memoId },
    include: {
      department: true,
      originatingDirector: true,
      delegatedReviewer: true,
      evidence: true,
      transitions: { orderBy: { performedAt: 'asc' } },
    },
  });
  if (!memo) return null;

  const isCeo = actingUser.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN');
  const isOwner = memo.originatingDirectorId === actingUser.id;
  const isDelegatedReviewer = memo.delegatedReviewerId === actingUser.id;
  if (!isCeo && !isOwner && !isDelegatedReviewer) {
    throw new MemoValidationError('No access to this memo.');
  }
  return memo;
}
