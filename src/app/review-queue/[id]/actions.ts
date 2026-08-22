'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import {
  acceptSubmission,
  returnSubmissionForCorrection,
  routeSubmission,
  closeSubmission,
} from '@/lib/submissions/review';

// Corporate Secretariat's completeness check passed — accepted, awaiting the CEO's own review
// (#A27: only the CEO decides Board escalation now, from /executive-dashboard).
export async function noteSubmissionAction(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '') || undefined;
  await acceptSubmission(submissionId, user, comment);
  revalidatePath(`/review-queue/${submissionId}`);
  redirect('/review-queue');
}

export async function returnSubmissionAction(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '');
  await returnSubmissionForCorrection(submissionId, user, comment);
  revalidatePath(`/review-queue/${submissionId}`);
  redirect('/review-queue');
}

export async function routeSubmissionAction(submissionId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await routeSubmission(submissionId, user);
  revalidatePath(`/submissions/${submissionId}`);
  redirect(`/submissions/${submissionId}`);
}

export async function closeSubmissionAction(submissionId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await closeSubmission(submissionId, user);
  revalidatePath(`/submissions/${submissionId}`);
  redirect(`/submissions/${submissionId}`);
}
