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
  acceptAndEndorseForBoard,
} from '@/lib/submissions/review';

// SEMC "Noted" outcome — accepted, stays at SMC level, no Board Paper expected.
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

// SEMC "Endorsed for Board" outcome — see docs/mvp-directors-portal-plan.md's flow ("SEMC
// Deliberations decides if the paper would go to Board"). Accepts and endorses in one step; the
// Director then submits the actual Board Paper from the submission detail page.
export async function endorseForBoardAction(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '') || undefined;
  await acceptAndEndorseForBoard(submissionId, user, comment);
  revalidatePath(`/review-queue/${submissionId}`);
  revalidatePath('/board-papers');
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
