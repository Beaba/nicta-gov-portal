'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { markEndorsedForBoard, markNotVettedForBoard } from '@/lib/submissions/review';

// #A32 — "CEO confirms Board escalation," step 2 of the two-step model (step 1,
// "SEMC recommends," is recordBoardEscalationAction in semc/actions.ts). Reuses the existing,
// already-tested markEndorsedForBoard/markNotVettedForBoard (#A27) rather than a new field —
// endorsedForBoard already *is* the CEO's confirmation.
export async function confirmBoardEscalationAction(submissionId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await markEndorsedForBoard(submissionId, user, String(formData.get('comment') ?? 'Board escalation confirmed by the CEO.'));
  revalidatePath('/executive-dashboard/semc/escalations');
  redirect('/executive-dashboard/semc/escalations');
}

export async function declineBoardEscalationAction(submissionId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await markNotVettedForBoard(submissionId, user, String(formData.get('comment') ?? ''));
  revalidatePath('/executive-dashboard/semc/escalations');
  redirect('/executive-dashboard/semc/escalations');
}
