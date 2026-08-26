import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listLatestDepartmentPerformance } from '@/lib/performance/departmentPerformance';
import { RISK_STATUS_LABEL, DEFAULT_RISK_THRESHOLDS } from '@/lib/performance/riskService';
import { PortalShell } from '@/components/PortalShell';

const TONE: Record<string, string> = {
  ON_TRACK: 'bg-status-success-bg text-status-success',
  AT_RISK: 'bg-status-warning-bg text-status-warning',
  CRITICAL: 'bg-status-danger-bg text-status-danger',
  NO_DATA: 'bg-nicta-neutral-100 text-nicta-neutral-700',
};

export default async function ExecutiveDepartmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER')) redirect('/');

  const rows = await listLatestDepartmentPerformance();

  return (
    <PortalShell user={user} active="executive-departments">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Departments</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Traffic-light status is computed by a reusable performance/risk service from each
        department&rsquo;s latest KPI/KRA snapshot — thresholds shown below are configurable demo
        settings, not official NICTA policy.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <div className="mt-4 rounded-md border border-nicta-neutral-200 bg-nicta-cream px-4 py-2 text-xs text-nicta-neutral-700">
        On Track ≥ {DEFAULT_RISK_THRESHOLDS.onTrackMinPercent}% average · At Risk ≥{' '}
        {DEFAULT_RISK_THRESHOLDS.atRiskMinPercent}% average · Critical below that · No Current Data
        when a department has never reported.
      </div>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
            <tr>
              <th className="px-5 py-2 font-semibold">Department</th>
              <th className="px-5 py-2 font-semibold">Overall Progress</th>
              <th className="px-5 py-2 font-semibold">KPI</th>
              <th className="px-5 py-2 font-semibold">KRA</th>
              <th className="px-5 py-2 font-semibold">Overdue Activities</th>
              <th className="px-5 py-2 font-semibold">Critical Risks</th>
              <th className="px-5 py-2 font-semibold">Status</th>
              <th className="px-5 py-2 font-semibold">Last Reported</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const overall =
                row.kpiPercent !== null && row.kraPercent !== null
                  ? Math.round((row.kpiPercent + row.kraPercent) / 2)
                  : null;
              return (
                <tr
                  key={row.departmentId}
                  className="border-b border-nicta-neutral-200 last:border-0"
                >
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">
                    {row.departmentName}
                  </td>
                  <td className="px-5 py-3">
                    {overall !== null ? (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-nicta-neutral-100">
                          <div className="h-full bg-nicta-teal" style={{ width: `${overall}%` }} />
                        </div>
                        <span className="text-xs text-nicta-neutral-700">{overall}%</span>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {row.kpiPercent !== null ? `${row.kpiPercent}%` : '—'}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {row.kraPercent !== null ? `${row.kraPercent}%` : '—'}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{row.overdueActivities}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{row.criticalRisks}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE[row.status]}`}
                    >
                      {RISK_STATUS_LABEL[row.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {row.lastReportedAt?.toLocaleDateString() ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </PortalShell>
  );
}
