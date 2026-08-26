import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import {
  listOrganisationalTrend,
  listLatestDepartmentPerformance,
} from '@/lib/performance/departmentPerformance';
import { PortalShell } from '@/components/PortalShell';
import { TrendLineChart } from '@/components/TrendLineChart';

export default async function ExecutivePerformancePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER')) redirect('/');

  const [trend, departments] = await Promise.all([
    listOrganisationalTrend(),
    listLatestDepartmentPerformance(),
  ]);

  return (
    <PortalShell user={user} active="executive-performance">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Performance &amp; KPIs</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Organisation-wide KPI/KRA trend and per-department breakdown, computed from recorded
        performance snapshots (seed/demo data for this milestone — see docs/known-limitations.md).
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-nicta-teal-dark">Organisational KPI &amp; KRA Trend</h2>
        {trend.length === 0 ? (
          <p className="mt-4 text-sm text-nicta-neutral-700">
            No performance data has been recorded yet.
          </p>
        ) : (
          <div className="mt-4">
            <TrendLineChart
              labels={trend.map((t) => t.periodLabel.split(' ')[0] ?? t.periodLabel)}
              series={[
                { name: 'KPI', values: trend.map((t) => t.kpiAveragePercent), color: '#153C44' },
                { name: 'KRA', values: trend.map((t) => t.kraAveragePercent), color: '#2AAFA0' },
              ]}
              height={280}
            />
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">Department Delivery Status</h2>
        <table className="w-full border-collapse text-sm">
          <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
            <tr>
              <th className="px-5 py-2 font-semibold">Department</th>
              <th className="px-5 py-2 font-semibold">KPI</th>
              <th className="px-5 py-2 font-semibold">KRA</th>
              <th className="px-5 py-2 font-semibold">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.departmentId} className="border-b border-nicta-neutral-200 last:border-0">
                <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{d.departmentName}</td>
                <td className="px-5 py-3 text-nicta-neutral-700">
                  {d.kpiPercent !== null ? `${d.kpiPercent}%` : '—'}
                </td>
                <td className="px-5 py-3 text-nicta-neutral-700">
                  {d.kraPercent !== null ? `${d.kraPercent}%` : '—'}
                </td>
                <td className="px-5 py-3 text-nicta-neutral-700">{d.overdueActivities}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PortalShell>
  );
}
