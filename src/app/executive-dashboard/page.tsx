import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { getCurrentUser } from '@/lib/auth';
import { listAllSubmissions, listSubmissionsAwaitingCeoReview } from '@/lib/submissions/review';
import { getSubmissionForUser } from '@/lib/submissions/submissions';
import { getCurrentSmcMeetingWithDeadline } from '@/lib/submissions/meetings';
import {
  listLatestDepartmentPerformance,
  listOrganisationalTrend,
  getOrganisationalSummary,
} from '@/lib/performance/departmentPerformance';
import { RISK_STATUS_LABEL, DEFAULT_RISK_THRESHOLDS } from '@/lib/performance/riskService';
import { listCriticalTasks } from '@/lib/executive/criticalTasks';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { DashboardMeetingBar } from '@/components/DashboardMeetingBar';
import { CeoVettingForm } from '@/components/CeoVettingForm';
import { ComingSoonBadge } from '@/components/ComingSoonBadge';
import { TrendLineChart } from '@/components/TrendLineChart';
import { ceoVetForBoardAction, ceoNotVetForBoardAction } from '@/app/executive-dashboard/actions';
import {
  DocumentIcon,
  ChartIcon,
  InboxIcon,
  ClockIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
} from '@/components/icons';

type SubmissionWithDepartment = Awaited<ReturnType<typeof listAllSubmissions>>[number];

// CEO ("reviews and reads") — client requirement, docs/mvp-directors-portal-plan.md#A18.
// #A31: rebuilt to match the approved CEO Executive Dashboard mockup — greeting, 6 KPI/risk stat
// cards, an organisational performance trend chart, a department status table (both backed by
// #A31's DepartmentPerformance snapshot + risk service, not hardcoded), Critical Tasks &
// Escalations, and the CEO's own existing Board-vetting panel (#A27) kept exactly as-is since it's
// real, tested workflow — not replaced with a static mockup section.
export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: { selected?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER')) redirect('/');

  const [
    submissions,
    meeting,
    awaitingReview,
    selectedSubmission,
    departmentRows,
    trend,
    orgSummary,
    criticalTasks,
  ] = await Promise.all([
    listAllSubmissions(user),
    getCurrentSmcMeetingWithDeadline(),
    listSubmissionsAwaitingCeoReview(user),
    loadSelectedSubmission(searchParams.selected, user),
    listLatestDepartmentPerformance(),
    listOrganisationalTrend(),
    getOrganisationalSummary(),
    listCriticalTasks(user),
  ]);

  const smcSubmissions = submissions.filter((s) => s.submissionCategory === 'SMC');
  const vettedCount = smcSubmissions.filter((s) => s.endorsedForBoard).length;

  const submissionDepartmentRows = summarizeByDepartment(smcSubmissions);

  const boundVet = selectedSubmission
    ? ceoVetForBoardAction.bind(null, selectedSubmission.id)
    : undefined;
  const boundNotVet = selectedSubmission
    ? ceoNotVetForBoardAction.bind(null, selectedSubmission.id)
    : undefined;
  const canVet =
    selectedSubmission?.workflowStatus === 'ACCEPTED' ||
    selectedSubmission?.workflowStatus === 'ROUTED';

  const hour = DateTime.now().setZone('Pacific/Port_Moresby').hour;
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user.name.split(' ')[0];

  return (
    <PortalShell user={user} active="executive-dashboard">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">CEO Executive Dashboard</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">Portal / CEO</p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />
      <p className="mt-4 text-lg font-semibold text-nicta-teal-dark">
        {greeting}, {firstName}
      </p>

      <DashboardMeetingBar
        meetingDate={meeting?.meetingDate ?? null}
        submissionsCloseAt={meeting?.deadline?.normalCloseAt ?? null}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DashboardStatCard
          label="Organisational KPI"
          value={
            orgSummary.organisationalKpiPercent !== null
              ? `${orgSummary.organisationalKpiPercent}%`
              : '—'
          }
          icon={ChartIcon}
        />
        <DashboardStatCard
          label="KRA Progress"
          value={orgSummary.kraProgressPercent !== null ? `${orgSummary.kraProgressPercent}%` : '—'}
          icon={ChartIcon}
        />
        <DashboardStatCard
          label="Papers Awaiting Approval"
          value={awaitingReview.length}
          icon={InboxIcon}
        />
        <DashboardStatCard
          label="Overdue Activities"
          value={orgSummary.totalOverdueActivities}
          icon={ClockIcon}
        />
        <DashboardStatCard label="Board-Ready Papers" value={vettedCount} icon={ShieldCheckIcon} />
        <DashboardStatCard
          label="Departments At Risk"
          value={orgSummary.departmentsAtRisk}
          icon={AlertTriangleIcon}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-nicta-teal-dark">
            Organisational Performance (KPI &amp; KRA Progress)
          </h2>
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
              />
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-nicta-teal-dark">Department Status</h2>
            <Link
              href="/executive-dashboard/departments"
              className="text-xs font-semibold text-nicta-teal hover:underline"
            >
              View all →
            </Link>
          </div>
          <p className="mt-1 text-[11px] text-nicta-neutral-700">
            Thresholds are configurable demo settings, not official NICTA policy (On Track ≥{' '}
            {DEFAULT_RISK_THRESHOLDS.onTrackMinPercent}%, At Risk ≥{' '}
            {DEFAULT_RISK_THRESHOLDS.atRiskMinPercent}%).
          </p>
          <ul className="mt-3 space-y-2">
            {departmentRows.map((row) => (
              <li key={row.departmentId} className="flex items-center justify-between text-sm">
                <span className="text-nicta-neutral-900">{row.departmentName}</span>
                <RiskStatusPill status={row.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">
          Critical Tasks &amp; Escalations
        </h2>
        {criticalTasks.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-nicta-neutral-700">
            No critical or overdue tasks right now.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Task</th>
                <th className="px-5 py-2 font-semibold">Owner</th>
                <th className="px-5 py-2 font-semibold">Due Date</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {criticalTasks.slice(0, 8).map((t) => (
                <tr
                  key={`${t.source}-${t.id}`}
                  className="border-b border-nicta-neutral-200 last:border-0"
                >
                  <td className="px-5 py-3">
                    <p className="font-semibold text-nicta-teal-dark">{t.title}</p>
                    <p className="text-xs text-nicta-neutral-700">{t.escalationReason}</p>
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {t.responsibleName ?? t.departmentName ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {t.dueDate?.toLocaleDateString() ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-status-danger-bg px-2.5 py-1 text-[11px] font-bold text-status-danger">
                      {t.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={t.linkUrl}
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

      {/* The CEO's own substantive Board-escalation decision (#A27) — Corporate Secretariat's
          completeness check no longer includes this power. Same ?selected={id} master-detail
          pattern as the Corporate Secretariat dashboard's Review Actions panel. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="font-semibold text-nicta-teal-dark">Approval Inbox — SMC Submissions</h2>
            <Link
              href="/executive-dashboard/approvals"
              className="text-xs font-semibold text-nicta-teal hover:underline"
            >
              View full inbox →
            </Link>
          </div>
          {awaitingReview.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-nicta-neutral-700">
              No accepted submissions are currently awaiting your review.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
                <tr>
                  <th className="px-5 py-2 font-semibold">Reference</th>
                  <th className="px-5 py-2 font-semibold">Department</th>
                  <th className="px-5 py-2 font-semibold">Paper title</th>
                  <th className="px-5 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {awaitingReview.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-nicta-neutral-200 last:border-0 ${
                      s.id === selectedSubmission?.id
                        ? 'bg-nicta-teal-light'
                        : 'hover:bg-nicta-neutral-50'
                    }`}
                  >
                    <td className="px-5 py-3 font-semibold text-nicta-teal-dark">
                      {s.referenceNumber}
                    </td>
                    <td className="px-5 py-3 text-nicta-neutral-700">{s.department.name}</td>
                    <td className="px-5 py-3 text-nicta-neutral-900">{s.title}</td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/executive-dashboard?selected=${s.id}`}
                        className="font-semibold text-nicta-teal hover:underline"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="h-fit rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-nicta-teal-dark">Vetting Decision</h2>
          {!selectedSubmission ? (
            <p className="mt-4 text-sm text-nicta-neutral-700">
              Select a submission to record your Board-vetting decision.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs text-nicta-neutral-700">
                  {selectedSubmission.referenceNumber}
                </p>
                <p className="font-semibold text-nicta-teal-dark">{selectedSubmission.title}</p>
                <p className="mt-1 text-xs text-nicta-neutral-700">
                  {selectedSubmission.paperType}
                </p>
              </div>
              {canVet && boundVet && boundNotVet ? (
                <>
                  <CeoVettingForm onVetForBoard={boundVet} onNotVetForBoard={boundNotVet} />
                  <div className="mt-3">
                    <ComingSoonBadge label="Digital signature" />
                  </div>
                </>
              ) : (
                <p className="text-sm text-nicta-neutral-700">
                  This submission has already been vetted or isn&rsquo;t awaiting your review.{' '}
                  <Link
                    href={`/submissions/${selectedSubmission.id}`}
                    className="font-semibold text-nicta-teal hover:underline"
                  >
                    View full detail →
                  </Link>
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white shadow-sm">
          <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">SMC Submission Overview</h2>
          {submissionDepartmentRows.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-nicta-neutral-700">No SMC submissions yet.</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
                <tr>
                  <th className="px-5 py-2 font-semibold">Department</th>
                  <th className="px-5 py-2 font-semibold">Submitted</th>
                  <th className="px-5 py-2 font-semibold">Late</th>
                  <th className="px-5 py-2 font-semibold">Vetted</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {submissionDepartmentRows.map((row) => (
                  <tr key={row.name} className="border-b border-nicta-neutral-200 last:border-0">
                    <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{row.name}</td>
                    <td className="px-5 py-3 text-nicta-neutral-700">{row.submitted}</td>
                    <td className="px-5 py-3 text-nicta-neutral-700">{row.late}</td>
                    <td className="px-5 py-3 text-nicta-neutral-700">{row.vetted}</td>
                    <td className="px-5 py-3">
                      <DepartmentStatusPill hasLate={row.late > 0} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="flex flex-col rounded-xl bg-white shadow-sm">
          <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">
            CEO Comments &amp; Delegated Tasks
          </h2>
          <div className="flex flex-1 flex-col gap-3 px-5 pb-5">
            <Link
              href="/executive-dashboard/comments"
              className="flex items-center justify-between rounded-md border border-nicta-neutral-200 px-4 py-3 text-sm hover:bg-nicta-neutral-100"
            >
              <span className="font-medium text-nicta-teal-dark">View CEO Comments</span>
              <DocumentIcon className="h-4 w-4 text-nicta-teal" />
            </Link>
            <Link
              href="/delegations"
              className="flex items-center justify-between rounded-md border border-nicta-neutral-200 px-4 py-3 text-sm hover:bg-nicta-neutral-100"
            >
              <span className="font-medium text-nicta-teal-dark">View Delegated Tasks</span>
              <ChartIcon className="h-4 w-4 text-nicta-teal" />
            </Link>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}

function RiskStatusPill({ status }: { status: keyof typeof RISK_STATUS_LABEL }) {
  const tones: Record<string, string> = {
    ON_TRACK: 'bg-status-success-bg text-status-success',
    AT_RISK: 'bg-status-warning-bg text-status-warning',
    CRITICAL: 'bg-status-danger-bg text-status-danger',
    NO_DATA: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tones[status]}`}>
      {RISK_STATUS_LABEL[status]}
    </span>
  );
}

type DepartmentRow = { name: string; submitted: number; late: number; vetted: number };

// Departments are configurable reference data, never hardcoded (CLAUDE.md, docs/assumptions-and-
// decisions.md#A4) — the row set is derived from whichever department names actually appear on
// this period's SMC submissions, not a fixed list.
function summarizeByDepartment(smcSubmissions: SubmissionWithDepartment[]): DepartmentRow[] {
  const byDepartment = new Map<string, DepartmentRow>();
  for (const s of smcSubmissions) {
    const name = s.department.name;
    const row = byDepartment.get(name) ?? { name, submitted: 0, late: 0, vetted: 0 };
    row.submitted += 1;
    if (s.isLate) row.late += 1;
    if (s.endorsedForBoard) row.vetted += 1;
    byDepartment.set(name, row);
  }
  return Array.from(byDepartment.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// "Attention" vs "Complete" is a dashboard-level rollup, not a single Submission's workflowStatus,
// so it doesn't fit StatusBadge's prop shape — same warning/success pill tokens, new rule: a
// department needs the CEO's attention if any of its SMC submissions this period are late.
function DepartmentStatusPill({ hasLate }: { hasLate: boolean }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
        hasLate
          ? 'bg-status-warning-bg text-status-warning'
          : 'bg-status-success-bg text-status-success'
      }`}
    >
      {hasLate ? 'Attention' : 'Complete'}
    </span>
  );
}

// Backs the "Vetting Decision" panel's master-detail selection (?selected={id}) — same pattern and
// same reasoning as review-queue/page.tsx's loadSelectedSubmission: a bad/inaccessible id must
// never crash or redirect the whole dashboard, only leave the panel on its placeholder state.
async function loadSelectedSubmission(id: string | undefined, user: AuthenticatedUser) {
  if (!id) return null;
  try {
    return await getSubmissionForUser(id, user);
  } catch (err) {
    if (err instanceof AuthorizationError) return null;
    return null;
  }
}
