import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listWeeklyReportsForUser } from '@/lib/reporting/weeklyReports';
import { getReportingWeekFor, isPastWeeklyDeadline } from '@/lib/reporting/weeklyDeadline';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';
import { submitWeeklyReportAction, forwardWeeklyReportToCeoAction } from '@/app/my-workplan/actions';

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  SUBMITTED: 'bg-status-success-bg text-status-success',
  LATE: 'bg-status-danger-bg text-status-danger',
  UNDER_DIRECTOR_REVIEW: 'bg-status-warning-bg text-status-warning',
  RETURNED_FOR_CLARIFICATION: 'bg-status-danger-bg text-status-danger',
  VALIDATED_BY_DIRECTOR: 'bg-status-success-bg text-status-success',
  INCLUDED_IN_DIRECTOR_SUMMARY: 'bg-status-success-bg text-status-success',
  CLOSED: 'bg-nicta-neutral-100 text-nicta-neutral-700',
};

// #A32 — Manager's weekly reporting workspace, replacing the earlier stub. This is the
// Manager-role-specific screen the client's spec describes in full (14 fields, Friday-5pm-PGT
// deadline, "Forward to CEO"). Kept deliberately plain/utilitarian — the client's mockups are all
// CEO-facing; this page follows the same design system tokens without a supplied visual reference.
export default async function MyWorkplanPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'MANAGER' || r.roleCode === 'SYSTEM_ADMIN')) redirect('/');

  const [reports, week] = await Promise.all([listWeeklyReportsForUser(user), Promise.resolve(getReportingWeekFor())]);
  const isLateNow = isPastWeeklyDeadline(week);

  return (
    <PortalShell user={user}>
      <h1 className="text-2xl font-semibold text-nicta-teal-dark">My Weekly Reports</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        {week.label} · Deadline: 5:00 PM Friday, PGT
        {isLateNow && <span className="ml-2 font-semibold text-status-danger">— deadline has passed</span>}
      </p>

      <section className="mt-6 rounded-xl border border-nicta-neutral-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-nicta-teal-dark">Submit this week&rsquo;s report</h2>
        <form action={submitWeeklyReportAction} className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Category</label>
              <select name="category" className="input mt-1" defaultValue="BAU">
                <option value="Project">Project</option>
                <option value="BAU">BAU</option>
                <option value="Ad-hoc">Ad-hoc</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Progress (%)</label>
              <input type="number" name="progressPercent" min={0} max={100} required className="input mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-nicta-teal-dark">KPI/KRA contribution</label>
            <input name="kpiKraContribution" className="input mt-1" />
          </div>
          <div>
            <label className="text-xs font-medium text-nicta-teal-dark">Work completed</label>
            <textarea name="workCompleted" required rows={2} className="input mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Milestones achieved</label>
              <textarea name="milestonesAchieved" rows={2} className="input mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Planned work</label>
              <textarea name="plannedWork" rows={2} className="input mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Delays</label>
              <textarea name="delays" rows={2} className="input mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Risks</label>
              <textarea name="risks" rows={2} className="input mt-1" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-nicta-teal-dark">Decisions or assistance required</label>
            <textarea name="decisionsRequired" rows={2} className="input mt-1" />
          </div>
          {isLateNow && (
            <div>
              <label className="text-xs font-medium text-status-danger">
                Late-submission justification (required — the deadline has passed)
              </label>
              <textarea name="lateJustification" required rows={2} className="input mt-1" />
            </div>
          )}
          <button type="submit" className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Submit Weekly Report
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 text-sm font-semibold text-nicta-teal-dark">My Report History</h2>
        {reports.length === 0 ? (
          <EmptyState title="You haven't submitted a weekly report yet." />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Reference</th>
                <th className="px-5 py-2 font-semibold">Week</th>
                <th className="px-5 py-2 font-semibold">Progress</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Forward to CEO</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal">{r.referenceNumber}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{r.reportingPeriod.label}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{r.progressPercent}%</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[r.status] ?? ''}`}>
                      {r.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <form action={forwardWeeklyReportToCeoAction.bind(null, r.id)} className="flex items-center gap-2">
                      <input
                        name="reason"
                        placeholder="Reason (optional)"
                        className="w-32 rounded border border-nicta-neutral-200 px-2 py-1 text-xs"
                      />
                      <button type="submit" className="text-xs font-semibold text-nicta-teal hover:underline">
                        Forward
                      </button>
                    </form>
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
