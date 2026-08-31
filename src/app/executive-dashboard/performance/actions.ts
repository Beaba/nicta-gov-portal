'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { createMilestone } from '@/lib/performance/milestones';

export async function createMilestoneAction(formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await createMilestone(
    {
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? '') || undefined,
      departmentId: String(formData.get('departmentId') ?? ''),
      responsibleDirectorId: String(formData.get('responsibleDirectorId') ?? ''),
      targetDescription: String(formData.get('targetDescription') ?? ''),
      startDate: formData.get('startDate') ? new Date(String(formData.get('startDate'))) : undefined,
      dueDate: new Date(String(formData.get('dueDate'))),
    },
    user,
  );
  revalidatePath('/executive-dashboard/performance');
  redirect('/executive-dashboard/performance');
}
