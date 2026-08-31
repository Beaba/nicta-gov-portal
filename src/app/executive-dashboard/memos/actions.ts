'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { createMemo, submitMemo, withdrawMemo } from '@/lib/memos/memos';

export async function createMemoAction(formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const memo = await createMemo(
    {
      category: String(formData.get('category') ?? ''),
      subject: String(formData.get('subject') ?? ''),
      departmentId: String(formData.get('departmentId') ?? user.departmentId ?? ''),
      purpose: String(formData.get('purpose') ?? ''),
      requestedDecision: String(formData.get('requestedDecision') ?? ''),
      background: String(formData.get('background') ?? '') || undefined,
      recommendation: String(formData.get('recommendation') ?? '') || undefined,
      financialValue: formData.get('financialValue') ? Number(formData.get('financialValue')) : undefined,
      budgetCode: String(formData.get('budgetCode') ?? '') || undefined,
      costCentre: String(formData.get('costCentre') ?? '') || undefined,
      priority: String(formData.get('priority') ?? 'MEDIUM'),
      dueDate: formData.get('dueDate') ? new Date(String(formData.get('dueDate'))) : undefined,
    },
    user,
  );
  await submitMemo(memo.id, user);
  revalidatePath('/executive-dashboard/memos');
  redirect('/executive-dashboard/memos');
}

export async function withdrawMemoAction(id: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await withdrawMemo(id, user);
  revalidatePath('/executive-dashboard/memos');
}
