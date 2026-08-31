import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import {
  listOrganisationalTrend,
  listLatestDepartmentPerformance,
} from '@/lib/performance/departmentPerformance';
import { listMilestonesForUser } from '@/lib/performance/milestones';
import { PortalShell } from '@/components/PortalShell';
import { TrendLineChart } from '@/components/TrendLineChart';
import { TrafficLight } from '@/components/TrafficLight';
import { EmptyState } from '@/components/EmptyState';
import { createMilestoneAction } from '@/app/executive-dashboard/performance/actions';

export default async function ExecutivePerformancePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER')) redirect('/');

  const [trend, departments, milestones, directors, allDepartments] = await Promise.all([
    listOrganisationalTrend(),
    listLatestDepartmentPerformance(),
    listMilestonesForUser(user),
    prisma.user.findMany({
      where: { isActive: true, roles: { some: { role: { code: 'SUBMITTER' } } } },
      include: { department: true },
      orderBy: { name: 'asc' },
    }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
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

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="font-semibold text-nicta-teal-dark">Milestones</h2>
            <p className="mt-1 text-xs text-nicta-neutral-700">
              Set milestones, assign responsible Directors, monitor progress and validate updates.
            </p>
          </div>
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              + New Milestone
            </summary>
            <form
              action={createMilestoneAction}
              className="absolute right-0 z-20 mt-2 w-96 space-y-3 rounded-lg border border-nicta-neutral-200 bg-white p-4 shadow-xl"
            >
              <div>
                <label className="text-xs font-medium text-nicta-teal-dark">Title</label>
                <input name="title" required className="input mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-nicta-teal-dark">Target</label>
                <textarea name="targetDescription" required rows={2} className="input mt-1" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-nicta-teal-dark">Department</label>
                  <select name="departmentId" required className="input mt-1" defaultValue="">
                    <option value="" disabled>
                      Select
                    </option>
                    {allDepartments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-nicta-teal-dark">Responsible Director</label>
                  <select name="responsibleDirectorId" required className="input mt-1" defaultValue="">
                    <option value="" disabled>
                      Select
                    </option>
                    {directors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-nicta-teal-dark">Start date</label>
                  <input type="date" name="startDate" className="input mt-1" />
                </div>
                <div>
                  <label className="text-xs font-medium text-nicta-teal-dark">Due date</label>
                  <input type="date" name="dueDate" required className="input mt-1" />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Create Milestone
              </button>
            </form>
          </details>
        </div>

        {milestones.length === 0 ? (
          <EmptyState title="No milestones have been set yet." />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Reference</th>
                <th className="px-5 py-2 font-semibold">Title</th>
                <th className="px-5 py-2 font-semibold">Director</th>
                <th className="px-5 py-2 font-semibold">Due</th>
                <th className="px-5 py-2 font-semibold">Progress</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Validation</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr key={m.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal">{m.referenceNumber}</td>
                  <td className="px-5 py-3 text-nicta-neutral-900">{m.title}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{m.responsibleDirectorName}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{m.dueDate.toLocaleDateString()}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{m.progressPercent}%</td>
                  <td className="px-5 py-3">
                    <TrafficLight status={m.status} compact />
                  </td>
                  <td className="px-5 py-3 text-xs text-nicta-neutral-700">
                    {m.validationStatus.replace(/_/g, ' ')}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/executive-dashboard/performance/milestones/${m.id}`}
                      className="text-sm font-semibold text-nicta-teal hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PortalShell>
  );
}
