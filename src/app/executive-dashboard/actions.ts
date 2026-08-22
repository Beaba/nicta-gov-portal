'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { markEndorsedForBoard, markNotVettedForBoard } from '@/lib/submissions/review';

// The CEO's own vetting actions (#A27) — mirrors the shape of review-queue/[id]/actions.ts's
// bound-submissionId server actions, kept in their own file since this is a distinct role's
// decision, not a Corporate Secretariat one.
export async function ceoVetForBoardAction(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '');
  await markEndorsedForBoard(submissionId, user, comment);
  revalidatePath('/executive-dashboard');
  revalidatePath(`/submissions/${submissionId}`);
  redirect('/executive-dashboard');
}

export async function ceoNotVetForBoardAction(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const comment = String(formData.get('comment') ?? '');
  await markNotVettedForBoard(submissionId, user, comment);
  revalidatePath('/executive-dashboard');
  redirect('/executive-dashboard');
}
