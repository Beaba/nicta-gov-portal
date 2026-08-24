'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import {
  issueDelegation,
  acknowledgeDelegation,
  startDelegationWork,
  flagDelegationRisk,
  clearDelegationRisk,
  submitDelegationForReview,
  resumeDelegationWork,
  returnDelegationForMoreWork,
  completeDelegation,
  closeDelegation,
  cancelDelegation,
  extendDelegationDueDate,
  requestDelegationExtension,
  addDelegationUpdate,
  addCeoComment,
} from '@/lib/delegations/delegations';

function revalidateAndReturn(delegationId: string) {
  revalidatePath('/delegations');
  revalidatePath(`/delegations/${delegationId}`);
  redirect(`/delegations/${delegationId}`);
}

export async function issueDelegationAction(delegationId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await issueDelegation(delegationId, user);
  revalidateAndReturn(delegationId);
}

export async function acknowledgeDelegationAction(delegationId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await acknowledgeDelegation(delegationId, user);
  revalidateAndReturn(delegationId);
}

export async function startDelegationWorkAction(delegationId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await startDelegationWork(delegationId, user);
  revalidateAndReturn(delegationId);
}

export async function flagDelegationRiskAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '');
  await flagDelegationRisk(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}

export async function clearDelegationRiskAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '') || undefined;
  await clearDelegationRisk(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}

export async function submitDelegationForReviewAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '') || undefined;
  await submitDelegationForReview(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}

export async function resumeDelegationWorkAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '') || undefined;
  await resumeDelegationWork(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}

export async function returnDelegationForMoreWorkAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '');
  await returnDelegationForMoreWork(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}

export async function completeDelegationAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '') || undefined;
  await completeDelegation(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}

export async function closeDelegationAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const closureDecision = String(formData.get('closureDecision') ?? '');
  await closeDelegation(delegationId, user, closureDecision);
  revalidateAndReturn(delegationId);
}

export async function cancelDelegationAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '');
  await cancelDelegation(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}

export async function extendDelegationDueDateAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const newDueDate = String(formData.get('newDueDate') ?? '');
  const comment = String(formData.get('comment') ?? '') || undefined;
  if (!newDueDate) return;
  await extendDelegationDueDate(delegationId, user, new Date(newDueDate), comment);
  revalidateAndReturn(delegationId);
}

export async function requestDelegationExtensionAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '');
  await requestDelegationExtension(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}

export async function addDelegationUpdateAction(
  delegationId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '');
  await addDelegationUpdate(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}

export async function addCeoCommentAction(delegationId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '');
  await addCeoComment(delegationId, user, comment);
  revalidateAndReturn(delegationId);
}
