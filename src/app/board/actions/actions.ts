'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { updateBoardActionProgress } from '@/lib/board/actionItems';
import type { ActionItemStatus } from '@prisma/client';

export async function updateBoardActionAction(actionId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const status = String(formData.get('status') ?? '') as ActionItemStatus | '';
  const progressUpdate = String(formData.get('progressUpdate') ?? '') || undefined;
  const completionComment = String(formData.get('completionComment') ?? '') || undefined;

  await updateBoardActionProgress(actionId, user, {
    status: status || undefined,
    progressUpdate,
    completionComment,
  });
  revalidatePath('/board/actions');
}
