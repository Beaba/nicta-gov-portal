'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import {
  approveMemo,
  approveMemoWithConditions,
  returnMemoWithComments,
  rejectMemo,
  requestMemoMoreInformation,
  delegateMemoReview,
} from '@/lib/memos/memos';

function revalidateAndReturn(memoId: string) {
  revalidatePath('/executive-dashboard/approvals');
  redirect(`/executive-dashboard/approvals?selected=${memoId}`);
}

export async function approveMemoAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await approveMemo(id, user, String(formData.get('comment') ?? '') || undefined);
  revalidateAndReturn(id);
}

export async function approveMemoWithConditionsAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await approveMemoWithConditions(id, user, String(formData.get('comment') ?? ''));
  revalidateAndReturn(id);
}

export async function returnMemoWithCommentsAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await returnMemoWithComments(id, user, String(formData.get('comment') ?? ''));
  revalidateAndReturn(id);
}

export async function requestMemoMoreInformationAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await requestMemoMoreInformation(id, user, String(formData.get('comment') ?? ''));
  revalidateAndReturn(id);
}

export async function rejectMemoAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await rejectMemo(id, user, String(formData.get('comment') ?? ''));
  revalidateAndReturn(id);
}

export async function delegateMemoReviewAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await delegateMemoReview(id, user, String(formData.get('delegatedReviewerId') ?? ''));
  revalidateAndReturn(id);
}
