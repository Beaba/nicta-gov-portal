import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listWeeklyReportsForUser } from '@/lib/reporting/weeklyReports';
import { listMilestonesForUser } from '@/lib/performance/milestones';
import { getReportingWeekFor } from '@/lib/reporting/weeklyDeadline';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';
import { TrafficLight } from '@/components/TrafficLight';
import {
  reviewWeeklyReportAction,
  returnWeeklyReportAction,
  validateWeeklyReportAction,
  submitDirectorSummaryAction,
} from '@/app/department-dashboard/actions';

// #A32 — Director's weekly-oversight workspace, replacing the earlier stub (this route was
// previously a ComingSoonPage — building real content here is additive, not a replacement of
// working functionality; the Director's primary SMC-submission workflow stays on /submissions,
// untouched). Gated on SUBMITTER (the role code every Director-facing check in this codebase
// actually uses, #A21) as well as the legacy DIRECTOR code, so real Directors can reach it.
export default async function DepartmentDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isDirector = user.roles.some(
    (r) => r.roleCode === 'SUBMITTER' || r.roleCode === 'DIRECTOR' || r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isDirector) redirect('/');

  const [reports, milestones, week] = await Promise.all([
    listWeeklyReportsForUser(user),
    listMilestonesForUser(user),
    Promise.resolve(getReportingWeekFor()),
  ]);

  const needsReview = reports.filter((r) => r.status === 'SUBMITTED' || r.status === 'LATE');

  return (
    <PortalShell user={user} active="department-dashboard">
      <h1 className="text-2xl font-semibold text-nicta-teal-dark">Department Dashboard</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">{week.label}</p>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 text-sm font-semibold text-nicta-teal-dark">
          Manager Weekly Reports ({needsReview.length} awaiting review)
        </h2>
        {reports.length === 0 ? (
          <EmptyState title="No weekly reports from your department's Managers yet." />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Manager</th>
                <th className="px-5 py-2 font-semibold">Progress</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{r.manager.name}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{r.progressPercent}%</td>
                  <td className="px-5 py-3 text-xs text-nicta-neutral-700">{r.status.replace(/_/g, ' ')}</td>
                  <td className="px-5 py-3">
                    {(r.status === 'SUBMITTED' || r.status === 'LATE') && (
                      <form action={reviewWeeklyReportAction.bind(null, r.id)}>
                        <button type="submit" className="text-xs font-semibold text-nicta-teal hover:underline">
                          Start Review
                        </button>
                      </form>
                    )}
                    {r.status === 'UNDER_DIRECTOR_REVIEW' && (
                      <div className="flex gap-3">
                        <form action={validateWeeklyReportAction.bind(null, r.id)}>
                          <button type="submit" className="text-xs font-semibold text-status-success hover:underline">
                            Validate
                          </button>
                        </form>
                        <details>
                          <summary className="cursor-pointer text-xs font-semibold text-status-danger">Return</summary>
                          <form action={returnWeeklyReportAction.bind(null, r.id)} className="mt-1 flex gap-1">
                            <input name="comment" required placeholder="Reason" className="w-28 rounded border border-nicta-neutral-200 px-1 py-0.5 text-xs" />
                            <button type="submit" className="text-xs text-status-danger">Send</button>
                          </form>
                        </details>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 text-sm font-semibold text-nicta-teal-dark">My Milestones</h2>
        {milestones.length === 0 ? (
          <EmptyState title="No milestones assigned to you yet." />
        ) : (
          <ul className="divide-y divide-nicta-neutral-200">
            {milestones.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span className="font-medium text-nicta-neutral-900">{m.title}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-nicta-neutral-700">{m.progressPercent}%</span>
                  <TrafficLight status={m.status} compact />
                  <a
                    href={`/executive-dashboard/performance/milestones/${m.id}`}
                    className="text-xs font-semibold text-nicta-teal hover:underline"
                  >
                    Update
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-nicta-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-nicta-teal-dark">Submit Director Summary to CEO</h2>
        <form action={submitDirectorSummaryAction} className="mt-3 space-y-3">
          {[
            ['keyAchievements', 'Key achievements'],
            ['kpiKraProgressNote', 'KPI and KRA progress'],
            ['milestonesNote', 'Milestones'],
            ['criticalActivities', 'Critical activities'],
            ['delays', 'Delays'],
            ['risks', 'Risks'],
            ['decisionsRequired', 'Decisions required'],
            ['nextPeriodPriorities', 'Next-period priorities'],
          ].map(([name, label]) => (
            <div key={name}>
              <label className="text-xs font-medium text-nicta-teal-dark">{label}</label>
              <textarea name={name} rows={2} className="input mt-1" />
            </div>
          ))}
          <button type="submit" className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Submit to CEO
          </button>
        </form>
      </section>
    </PortalShell>
  );
}
