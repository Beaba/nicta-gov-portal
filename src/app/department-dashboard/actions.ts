'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import {
  reviewWeeklyReport,
  returnWeeklyReportForClarification,
  validateWeeklyReport,
} from '@/lib/reporting/weeklyReports';
import { upsertDirectorSummary } from '@/lib/reporting/directorSummaries';

export async function reviewWeeklyReportAction(reportId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await reviewWeeklyReport(reportId, user);
  revalidatePath('/department-dashboard');
}

export async function returnWeeklyReportAction(reportId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await returnWeeklyReportForClarification(reportId, user, String(formData.get('comment') ?? ''));
  revalidatePath('/department-dashboard');
}

export async function validateWeeklyReportAction(reportId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await validateWeeklyReport(reportId, user, String(formData.get('comment') ?? '') || undefined);
  revalidatePath('/department-dashboard');
}

export async function submitDirectorSummaryAction(formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  if (!user.departmentId) throw new Error('Your account has no department assigned.');
  await upsertDirectorSummary(
    {
      departmentId: user.departmentId,
      keyAchievements: String(formData.get('keyAchievements') ?? '') || undefined,
      kpiKraProgressNote: String(formData.get('kpiKraProgressNote') ?? '') || undefined,
      milestonesNote: String(formData.get('milestonesNote') ?? '') || undefined,
      criticalActivities: String(formData.get('criticalActivities') ?? '') || undefined,
      delays: String(formData.get('delays') ?? '') || undefined,
      risks: String(formData.get('risks') ?? '') || undefined,
      decisionsRequired: String(formData.get('decisionsRequired') ?? '') || undefined,
      nextPeriodPriorities: String(formData.get('nextPeriodPriorities') ?? '') || undefined,
    },
    user,
  );
  revalidatePath('/department-dashboard');
  redirect('/department-dashboard');
}
