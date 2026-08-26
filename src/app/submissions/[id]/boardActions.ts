'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { recordBoardDecision, type BoardDecisionType } from '@/lib/board/decisions';
import { finalizeBoardOutcome } from '@/lib/board/papers';

export async function recordBoardDecisionAction(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const decisionType = String(formData.get('decisionType') ?? '') as BoardDecisionType;
  const comment = String(formData.get('comment') ?? '') || undefined;
  const conditions = String(formData.get('conditions') ?? '') || undefined;
  await recordBoardDecision(submissionId, user, { decisionType, comment, conditions });
  revalidatePath(`/submissions/${submissionId}`);
}

export async function finalizeBoardOutcomeAction(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const outcome = String(formData.get('outcome') ?? '') as 'APPROVED' | 'REJECTED' | 'DEFERRED';
  await finalizeBoardOutcome(submissionId, outcome, user);
  revalidatePath(`/submissions/${submissionId}`);
}
