import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listWeeklyComplianceSummary } from '@/lib/reporting/weeklyReports';
import { getReportingWeekFor } from '@/lib/reporting/weeklyDeadline';
import { PortalShell } from '@/components/PortalShell';
import { TrafficLight } from '@/components/TrafficLight';
import { EmptyState } from '@/components/EmptyState';

// #A32 — the CEO's Weekly Management screen: a departmental compliance summary only. Per the
// client's explicit requirement ("The CEO must not automatically receive access to every detailed
// Manager report"), this page never queries or links to individual WeeklyManagerReport rows —
// only the aggregate counts listWeeklyComplianceSummary computes. A CEO who needs to see one
// specific report relies on the Director/Manager using "Forward to CEO"
// (reportAccessGrants.ts) — there is intentionally no "browse all reports" escape hatch here.
export default async function WeeklyManagementPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN')) redirect('/');

  const week = getReportingWeekFor();
  const rows = await listWeeklyComplianceSummary(user);

  return (
    <PortalShell user={user} active="executive-weekly-management">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Weekly Management Overview</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        {week.label} · Deadline: 5:00 PM Friday, Papua New Guinea time. Departmental summary only —
        detailed Manager reports remain restricted to the Manager, their Director, and authorised
        departmental reviewers.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      {rows.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white shadow-sm">
          <EmptyState title="No departments configured yet." />
        </div>
      ) : (
        <section className="mt-6 rounded-xl bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Department</th>
                <th className="px-5 py-2 font-semibold">Managers Expected</th>
                <th className="px-5 py-2 font-semibold">Reports Received</th>
                <th className="px-5 py-2 font-semibold">Late / Missing</th>
                <th className="px-5 py-2 font-semibold">Overall Progress</th>
                <th className="px-5 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.departmentId} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{row.departmentName}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{row.managersExpected}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{row.reportsReceived}</td>
                  <td className={`px-5 py-3 ${row.lateOrMissing > 0 ? 'font-semibold text-status-danger' : 'text-nicta-neutral-700'}`}>
                    {row.lateOrMissing}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {row.overallProgress === null ? '—' : `${row.overallProgress}%`}
                  </td>
                  <td className="px-5 py-3">
                    <TrafficLight
                      status={
                        row.lateOrMissing > 0
                          ? 'AT_RISK'
                          : row.overallProgress === null
                            ? 'NO_DATA'
                            : row.overallProgress >= 80
                              ? 'ON_TRACK'
                              : 'CRITICAL'
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </PortalShell>
  );
}
