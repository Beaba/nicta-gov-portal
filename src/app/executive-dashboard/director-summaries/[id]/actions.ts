'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { validateDirectorSummary, returnDirectorSummaryForClarification } from '@/lib/reporting/directorSummaries';

export async function validateDirectorSummaryAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await validateDirectorSummary(id, user, String(formData.get('comment') ?? '') || undefined);
  revalidatePath(`/executive-dashboard/director-summaries/${id}`);
  redirect(`/executive-dashboard/director-summaries/${id}`);
}

export async function returnDirectorSummaryForClarificationAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await returnDirectorSummaryForClarification(id, user, String(formData.get('comment') ?? ''));
  revalidatePath(`/executive-dashboard/director-summaries/${id}`);
  redirect(`/executive-dashboard/director-summaries/${id}`);
}
