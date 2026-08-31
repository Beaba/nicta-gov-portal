import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listDirectorSummariesForCeo } from '@/lib/reporting/directorSummaries';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';

const STATUS_TONE: Record<string, string> = {
  SUBMITTED: 'bg-status-warning-bg text-status-warning',
  AWAITING_CEO_VALIDATION: 'bg-status-warning-bg text-status-warning',
  VALIDATED: 'bg-status-success-bg text-status-success',
  RETURNED_FOR_CLARIFICATION: 'bg-status-danger-bg text-status-danger',
};

export default async function DirectorSummariesPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN')) redirect('/');

  const summaries = await listDirectorSummariesForCeo(user);

  return (
    <PortalShell user={user} active="executive-director-summaries">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Director Summaries</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Consolidated narrative summaries per department — achievements, KPI/KRA progress,
        milestones, critical activities, delays, risks, decisions required, and next-period
        priorities.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      {summaries.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white shadow-sm">
          <EmptyState title="No Director Summaries submitted for this reporting week yet." />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {summaries.map((s) => (
            <Link
              key={s.id}
              href={`/executive-dashboard/director-summaries/${s.id}`}
              className="block rounded-xl bg-white p-5 shadow-sm hover:bg-nicta-neutral-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-nicta-teal-dark">{s.department.name}</p>
                  <p className="text-xs text-nicta-neutral-700">{s.director.name}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[s.ceoValidationStatus] ?? 'bg-nicta-neutral-100 text-nicta-neutral-700'}`}
                >
                  {s.ceoValidationStatus.replace(/_/g, ' ')}
                </span>
              </div>
              {s.keyAchievements && (
                <p className="mt-2 truncate text-sm text-nicta-neutral-700">{s.keyAchievements}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
