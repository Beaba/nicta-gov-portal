'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { addComment, resolveComment, type CommentableEntityType } from '@/lib/board/comments';

export async function addCommentAction(
  entityType: CommentableEntityType,
  entityId: string,
  redirectPath: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const body = String(formData.get('body') ?? '');
  const parentId = String(formData.get('parentId') ?? '') || undefined;
  const visibility = String(formData.get('visibility') ?? 'BOARD_AND_SECRETARIAT') as
    'BOARD_ONLY' | 'BOARD_AND_SECRETARIAT';
  await addComment(entityType, entityId, user, { body, parentId, visibility });
  revalidatePath(redirectPath);
}

export async function resolveCommentAction(commentId: string, redirectPath: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await resolveComment(commentId, user);
  revalidatePath(redirectPath);
}
