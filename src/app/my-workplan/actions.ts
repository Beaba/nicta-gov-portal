'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { submitWeeklyReport } from '@/lib/reporting/weeklyReports';
import { forwardToCeo } from '@/lib/reporting/reportAccessGrants';

export async function submitWeeklyReportAction(formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  if (!user.departmentId) throw new Error('Your account has no department assigned.');

  await submitWeeklyReport(
    {
      departmentId: user.departmentId,
      category: String(formData.get('category') ?? 'BAU') as 'Project' | 'BAU' | 'Ad-hoc',
      kpiKraContribution: String(formData.get('kpiKraContribution') ?? '') || undefined,
      progressPercent: Number(formData.get('progressPercent') ?? 0),
      workCompleted: String(formData.get('workCompleted') ?? ''),
      milestonesAchieved: String(formData.get('milestonesAchieved') ?? '') || undefined,
      plannedWork: String(formData.get('plannedWork') ?? '') || undefined,
      delays: String(formData.get('delays') ?? '') || undefined,
      risks: String(formData.get('risks') ?? '') || undefined,
      decisionsRequired: String(formData.get('decisionsRequired') ?? '') || undefined,
      lateJustification: String(formData.get('lateJustification') ?? '') || undefined,
    },
    user,
  );
  revalidatePath('/my-workplan');
  redirect('/my-workplan');
}

export async function forwardWeeklyReportToCeoAction(reportId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const { prisma } = await import('@/lib/db/prisma');
  const report = await prisma.weeklyManagerReport.findUniqueOrThrow({ where: { id: reportId } });
  const director = await prisma.user.findFirst({
    where: { departmentId: report.departmentId, isActive: true, roles: { some: { role: { code: 'SUBMITTER' } } } },
  });
  await forwardToCeo({
    entityType: 'WeeklyManagerReport',
    entityId: reportId,
    entityVersion: report.version,
    reason: String(formData.get('reason') ?? '') || undefined,
    actingUser: user,
    notifyDirectorId: director?.id,
  });
  revalidatePath('/my-workplan');
  redirect('/my-workplan');
}
