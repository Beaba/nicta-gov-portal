'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';

// #A32 — CEO Office (EO/PA): draft a comment on a delegated memo. Deliberately NOT an approval
// action — reuses the generic Comment model (entityType "Memo"), same as every other comment on a
// Memo, so a draft comment from CEO Office is indistinguishable in the thread from anyone else's,
// and carries no approval weight.
export async function draftMemoCommentAction(memoId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const isCeoOffice = user.roles.some((r) => r.roleCode === 'CEO_OFFICE');
  if (!isCeoOffice) throw new Error('Only CEO Office staff use this action.');

  const body = String(formData.get('body') ?? '');
  if (!body.trim()) throw new Error('Enter a comment.');

  await prisma.comment.create({
    data: { entityType: 'Memo', entityId: memoId, authorId: user.id, body: `[Draft by CEO Office] ${body}` },
  });
  await recordAuditEvent({
    userId: user.id,
    action: 'CEO_OFFICE_DRAFT_COMMENT',
    entityType: 'Memo',
    entityId: memoId,
    newState: { body },
  });
  revalidatePath('/executive-dashboard/office');
}

export async function setMemoUrgencyAction(memoId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const isCeoOffice = user.roles.some((r) => r.roleCode === 'CEO_OFFICE');
  if (!isCeoOffice) throw new Error('Only CEO Office staff use this action.');

  const priority = String(formData.get('priority') ?? 'MEDIUM');
  await prisma.memo.update({ where: { id: memoId }, data: { priority } });
  await recordAuditEvent({
    userId: user.id,
    action: 'CEO_OFFICE_URGENCY_SET',
    entityType: 'Memo',
    entityId: memoId,
    newState: { priority },
  });
  revalidatePath('/executive-dashboard/office');
}
