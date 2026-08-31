'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import {
  submitMilestoneProgress,
  validateMilestone,
  returnMilestoneForClarification,
  changeMilestoneTarget,
} from '@/lib/performance/milestones';

export async function submitMilestoneProgressAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await submitMilestoneProgress(id, user, {
    progressPercent: Number(formData.get('progressPercent') ?? 0),
    directorComment: String(formData.get('directorComment') ?? '') || undefined,
  });
  revalidatePath(`/executive-dashboard/performance/milestones/${id}`);
  redirect(`/executive-dashboard/performance/milestones/${id}`);
}

export async function validateMilestoneAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await validateMilestone(id, user, String(formData.get('ceoComment') ?? '') || undefined);
  revalidatePath(`/executive-dashboard/performance/milestones/${id}`);
  redirect(`/executive-dashboard/performance/milestones/${id}`);
}

export async function returnMilestoneForClarificationAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await returnMilestoneForClarification(id, user, String(formData.get('ceoComment') ?? ''));
  revalidatePath(`/executive-dashboard/performance/milestones/${id}`);
  redirect(`/executive-dashboard/performance/milestones/${id}`);
}

export async function changeMilestoneTargetAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await changeMilestoneTarget(
    id,
    user,
    {
      targetDescription: String(formData.get('targetDescription') ?? '') || undefined,
      dueDate: formData.get('dueDate') ? new Date(String(formData.get('dueDate'))) : undefined,
    },
    String(formData.get('reason') ?? ''),
  );
  revalidatePath(`/executive-dashboard/performance/milestones/${id}`);
  redirect(`/executive-dashboard/performance/milestones/${id}`);
}
