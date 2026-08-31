import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDirectorSummaryForUser } from '@/lib/reporting/directorSummaries';
import { PortalShell } from '@/components/PortalShell';
import {
  validateDirectorSummaryAction,
  returnDirectorSummaryForClarificationAction,
} from '@/app/executive-dashboard/director-summaries/[id]/actions';

export default async function DirectorSummaryDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const summary = await getDirectorSummaryForUser(params.id, user);
  if (!summary) notFound();

  const isCeo = user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN');
  const bind = (fn: (id: string, formData: FormData) => Promise<void>) => fn.bind(null, summary.id);

  const rows: { label: string; value: string | null }[] = [
    { label: 'Key achievements', value: summary.keyAchievements },
    { label: 'KPI and KRA progress', value: summary.kpiKraProgressNote },
    { label: 'Milestones', value: summary.milestonesNote },
    { label: 'Critical activities', value: summary.criticalActivities },
    { label: 'Delays', value: summary.delays },
    { label: 'Risks', value: summary.risks },
    { label: 'Decisions required', value: summary.decisionsRequired },
    { label: 'Next-period priorities', value: summary.nextPeriodPriorities },
  ];

  return (
    <PortalShell user={user} active="executive-director-summaries">
      <h1 className="text-2xl font-semibold text-nicta-teal-dark">{summary.department.name}</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        {summary.director.name} · {summary.reportingPeriod.label} · Last reporting date:{' '}
        {summary.lastReportingDate?.toLocaleDateString() ?? '—'}
      </p>
      <p className="mt-2 text-xs font-semibold text-nicta-teal-dark">
        Validation status: {summary.ceoValidationStatus.replace(/_/g, ' ')}
      </p>

      <dl className="mt-6 space-y-4">
        {rows.map(
          (r) =>
            r.value && (
              <div key={r.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-nicta-neutral-700">
                  {r.label}
                </dt>
                <dd className="mt-1 text-sm text-nicta-neutral-900">{r.value}</dd>
              </div>
            ),
        )}
      </dl>

      {summary.ceoComment && (
        <div className="mt-6 rounded-md border border-nicta-neutral-200 bg-nicta-neutral-50 p-4">
          <p className="text-sm font-semibold text-nicta-teal-dark">CEO comment</p>
          <p className="mt-1 text-sm text-nicta-neutral-700">{summary.ceoComment}</p>
        </div>
      )}

      {isCeo && summary.ceoValidationStatus !== 'VALIDATED' && (
        <section className="mt-8 space-y-3 rounded-lg border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">CEO validation</h2>
          <form action={bind(validateDirectorSummaryAction)} className="space-y-2">
            <textarea name="comment" rows={2} className="input" placeholder="Optional comment" />
            <button type="submit" className="rounded-md bg-status-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Validate
            </button>
          </form>
          <form action={bind(returnDirectorSummaryForClarificationAction)} className="space-y-2">
            <textarea name="comment" rows={2} required className="input" placeholder="Required — explain what needs clarification" />
            <button type="submit" className="rounded-md bg-status-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Return for Clarification
            </button>
          </form>
        </section>
      )}
    </PortalShell>
  );
}
