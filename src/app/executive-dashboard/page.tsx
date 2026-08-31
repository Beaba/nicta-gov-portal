    import Link from 'next/link';
import { redirect } from 'next/navigation';
import { DateTime } from 'luxon';
import { getCurrentUser } from '@/lib/auth';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { listDelegationsForCeo } from '@/lib/delegations/delegations';
import { listCeoApprovalInbox } from '@/lib/executive/approvalInbox';
import { listCriticalTasks } from '@/lib/executive/criticalTasks';
import {
  getOrganisationalSummary,
  listLatestDepartmentPerformance,
  listOrganisationalTrend,
} from '@/lib/performance/departmentPerformance';
import { DEFAULT_RISK_THRESHOLDS, RISK_STATUS_LABEL } from '@/lib/performance/riskService';
import { listAllSubmissions, listSubmissionsAwaitingCeoReview } from '@/lib/submissions/review';
import { getCurrentSmcMeetingWithDeadline } from '@/lib/submissions/meetings';
import { getSubmissionForUser } from '@/lib/submissions/submissions';
import { ceoNotVetForBoardAction, ceoVetForBoardAction } from '@/app/executive-dashboard/actions';
import { CeoVettingForm } from '@/components/CeoVettingForm';
import { ComingSoonBadge } from '@/components/ComingSoonBadge';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { TrafficLight } from '@/components/TrafficLight';
import { EmptyState as SharedEmptyState } from '@/components/EmptyState';
import { listMilestonesForUser } from '@/lib/performance/milestones';
import { listWeeklyComplianceSummary } from '@/lib/reporting/weeklyReports';
import { listDirectorSummariesForCeo } from '@/lib/reporting/directorSummaries';
import { listSemcReportsForCeoReview } from '@/lib/submissions/semcReview';
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  BellIcon,
  CalendarIcon,
  ChartIcon,
  ClockIcon,
  DocumentIcon,
  InboxIcon,
  PeopleIcon,
  PersonCheckIcon,
  ShieldCheckIcon,
  PaperPlaneIcon,
} from '@/components/icons';
import { PortalShell } from '@/components/PortalShell';
import { TrendLineChart } from '@/components/TrendLineChart';

type SubmissionWithDepartment = Awaited<ReturnType<typeof listAllSubmissions>>[number];
type DepartmentPerformance = Awaited<ReturnType<typeof listLatestDepartmentPerformance>>[number];
type DelegationRow = Awaited<ReturnType<typeof listDelegationsForCeo>>[number];

export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: { selected?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((role) => role.roleCode === 'EXECUTIVE_VIEWER')) redirect('/');

  const [
    submissions,
    meeting,
    awaitingReview,
    approvalInbox,
    selectedSubmission,
    departmentRows,
    trend,
    orgSummary,
    criticalTasks,
    delegations,
    milestones,
    weeklyCompliance,
    directorSummaries,
    semcAwaitingReview,
  ] = await Promise.all([
    listAllSubmissions(user),
    getCurrentSmcMeetingWithDeadline(),
    listSubmissionsAwaitingCeoReview(user),
    listCeoApprovalInbox(user),
    loadSelectedSubmission(searchParams.selected, user),
    listLatestDepartmentPerformance(),
    listOrganisationalTrend(),
    getOrganisationalSummary(),
    listCriticalTasks(user),
    listDelegationsForCeo(user),
    listMilestonesForUser(user),
    listWeeklyComplianceSummary(user),
    listDirectorSummariesForCeo(user),
    listSemcReportsForCeoReview(user),
  ]);

  const smcSubmissions = submissions.filter(
    (submission) => submission.submissionCategory === 'SMC',
  );
  const submissionDepartmentRows = summarizeByDepartment(smcSubmissions);
  const activeDelegations = delegations.filter(
    (delegation) => !['CLOSED', 'CANCELLED'].includes(delegation.status),
  );
  const canVet =
    selectedSubmission?.workflowStatus === 'ACCEPTED' ||
    selectedSubmission?.workflowStatus === 'ROUTED';
  const boundVet = selectedSubmission
    ? ceoVetForBoardAction.bind(null, selectedSubmission.id)
    : undefined;
  const boundNotVet = selectedSubmission
    ? ceoNotVetForBoardAction.bind(null, selectedSubmission.id)
    : undefined;

  const milestonesDue = milestones.filter(
    (m) => m.dueDate.getTime() - Date.now() < 14 * 24 * 60 * 60 * 1000 && m.progressPercent < 100,
  ).length;

  const now = DateTime.now().setZone('Pacific/Port_Moresby');
  const greeting =
    now.hour < 12 ? 'Good morning' : now.hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user.name.split(' ')[0];

  return (
    <PortalShell user={user} active="executive-dashboard" variant="executive">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-nicta-teal-dark">
            CEO Executive Dashboard
          </h1>
          <p className="mt-1 text-xs font-medium text-nicta-teal">
            Portal <span className="px-2 text-nicta-neutral-700">/</span> CEO
          </p>
          <p className="mt-2 text-sm font-semibold text-nicta-neutral-900">
            {greeting}, {firstName}
          </p>
        </div>
        {meeting && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-nicta-neutral-700">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-nicta-neutral-200 bg-white px-3 py-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-nicta-teal" />
              Next SMC: {formatDate(meeting.meetingDate)}
            </span>
            {meeting.deadline && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-nicta-neutral-200 bg-white px-3 py-1.5">
                <ClockIcon className="h-3.5 w-3.5 text-nicta-teal" />
                Submissions close: {formatDate(meeting.deadline.normalCloseAt)}
              </span>
            )}
          </div>
        )}
      </header>

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <DashboardStatCard
          label="Organisational KPI"
          value={formatPercent(orgSummary.organisationalKpiPercent)}
          icon={ChartIcon}
          compact
        />
        <DashboardStatCard
          label="KRA Progress"
          value={formatPercent(orgSummary.kraProgressPercent)}
          icon={PersonCheckIcon}
          compact
        />
        <DashboardStatCard
          label="Milestones Due"
          value={milestonesDue}
          icon={ClockIcon}
          tone={milestonesDue > 0 ? 'danger' : 'default'}
          compact
        />
        <DashboardStatCard
          label="Departments At Risk"
          value={orgSummary.departmentsAtRisk + orgSummary.departmentsCritical}
          icon={AlertTriangleIcon}
          tone="danger"
          compact
        />
        <DashboardStatCard
          label="Approvals Pending"
          value={approvalInbox.length}
          icon={InboxIcon}
          compact
        />
        <DashboardStatCard
          label="SEMC Papers"
          value={semcAwaitingReview.length}
          icon={PaperPlaneIcon}
          compact
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[0.92fr_1.08fr]">
        <DashboardPanel title="Organisational Performance (KPI & KRA Progress)" icon={ChartIcon}>
          <p className="mb-1 text-[11px] text-nicta-neutral-700">
            Organisation-wide reporting trend
          </p>
          {trend.length === 0 ? (
            <EmptyState>No performance data has been recorded yet.</EmptyState>
          ) : (
            <TrendLineChart
              height={190}
              labels={trend.map((point) => point.periodLabel.split(' ')[0] ?? point.periodLabel)}
              series={[
                {
                  name: 'KPI',
                  values: trend.map((point) => point.kpiAveragePercent),
                  color: '#153C44',
                },
                {
                  name: 'KRA',
                  values: trend.map((point) => point.kraAveragePercent),
                  color: '#008C8C',
                },
              ]}
            />
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Department Status"
          icon={PeopleIcon}
          action={{ href: '/executive-dashboard/departments', label: 'View all' }}
        >
          <div className="grid grid-cols-[minmax(0,1.4fr)_100px_minmax(120px,1fr)] gap-3 border-b border-nicta-neutral-200 pb-2 text-[10px] font-bold uppercase tracking-wide text-nicta-neutral-700">
            <span>Department</span>
            <span>Status</span>
            <span>Overall progress</span>
          </div>
          <div className="divide-y divide-nicta-neutral-200">
            {departmentRows.map((row) => {
              const progress = departmentProgress(row);
              return (
                <div
                  key={row.departmentId}
                  className="grid grid-cols-[minmax(0,1.4fr)_100px_minmax(120px,1fr)] items-center gap-3 py-2 text-xs"
                >
                  <span className="truncate font-medium text-nicta-neutral-900">
                    {row.departmentName}
                  </span>
                  <RiskStatusPill status={row.status} />
                  <div className="flex items-center gap-3">
                    <span className="w-8 text-right text-nicta-neutral-700">
                      {progress === null ? '—' : `${progress}%`}
                    </span>
                    <ProgressBar value={progress ?? 0} muted={progress === null} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-nicta-neutral-700">
            Demo thresholds: On Track ≥ {DEFAULT_RISK_THRESHOLDS.onTrackMinPercent}%, At Risk ≥{' '}
            {DEFAULT_RISK_THRESHOLDS.atRiskMinPercent}%.
          </p>
        </DashboardPanel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <DashboardPanel title="Critical Tasks & Escalations" icon={AlertTriangleIcon}>
          {criticalTasks.length === 0 ? (
            <EmptyState>No critical or overdue tasks right now.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="border-b border-nicta-neutral-200 text-[10px] uppercase tracking-wide text-nicta-neutral-700">
                  <tr>
                    <th className="pb-2 font-semibold">Task</th>
                    <th className="pb-2 font-semibold">Owner</th>
                    <th className="pb-2 font-semibold">Due date</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nicta-neutral-200">
                  {criticalTasks.slice(0, 5).map((task) => (
                    <tr key={`${task.source}-${task.id}`}>
                      <td className="max-w-[220px] py-2 pr-3">
                        <p className="truncate font-medium text-nicta-neutral-900">{task.title}</p>
                        <p className="truncate text-[10px] text-nicta-neutral-700">
                          {task.escalationReason}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">
                        {task.departmentName ?? task.responsibleName ?? '—'}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-nicta-neutral-700">
                        {task.dueDate ? formatDate(task.dueDate) : '—'}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusPill value={task.status} />
                      </td>
                      <td className="py-2 text-right">
                        <SmallLink href={task.linkUrl}>View</SmallLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="CEO Delegated Tasks"
          icon={PersonCheckIcon}
          action={{ href: '/delegations', label: 'View all' }}
        >
          {activeDelegations.length === 0 ? (
            <EmptyState>No active delegations.</EmptyState>
          ) : (
            <div className="space-y-1">
              {activeDelegations.slice(0, 5).map((delegation) => {
                const progress = delegationProgress(delegation.status);
                return (
                  <Link
                    key={delegation.id}
                    href={`/delegations/${delegation.id}`}
                    className="grid grid-cols-[minmax(0,1.15fr)_minmax(130px,1fr)_88px_92px] items-center gap-3 border-b border-nicta-neutral-200 py-2 text-xs last:border-0 hover:bg-nicta-neutral-50"
                  >
                    <span className="truncate font-medium text-nicta-neutral-900">
                      {delegation.title}
                    </span>
                    <span className="flex items-center gap-2">
                      <ProgressBar value={progress} />
                      <span className="w-8 text-right text-[10px] text-nicta-neutral-700">
                        {progress}%
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-nicta-neutral-700">
                      {formatDate(delegation.dueDate)}
                    </span>
                    <DelegationStatusPill delegation={delegation} />
                  </Link>
                );
              })}
            </div>
          )}
        </DashboardPanel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <DashboardPanel
          title="Weekly Management Overview"
          icon={ClockIcon}
          action={{ href: '/executive-dashboard/weekly-management', label: 'View all' }}
        >
          <p className="mb-2 text-[10px] text-nicta-neutral-700">
            Departmental summary only — the CEO does not automatically see individual Manager
            reports.
          </p>
          {weeklyCompliance.length === 0 ? (
            <SharedEmptyState title="No weekly reports recorded yet this week." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="border-b border-nicta-neutral-200 text-[10px] uppercase tracking-wide text-nicta-neutral-700">
                  <tr>
                    <th className="pb-2 font-semibold">Department</th>
                    <th className="pb-2 font-semibold">Received</th>
                    <th className="pb-2 font-semibold">Late/Missing</th>
                    <th className="pb-2 font-semibold">Progress</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nicta-neutral-200">
                  {weeklyCompliance.map((row) => (
                    <tr key={row.departmentId}>
                      <td className="max-w-[140px] truncate py-2 pr-3 font-medium text-nicta-neutral-900">
                        {row.departmentName}
                      </td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">
                        {row.reportsReceived}/{row.managersExpected}
                      </td>
                      <td className={`py-2 pr-3 ${row.lateOrMissing > 0 ? 'text-status-danger' : 'text-nicta-neutral-700'}`}>
                        {row.lateOrMissing}
                      </td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">
                        {row.overallProgress === null ? '—' : `${row.overallProgress}%`}
                      </td>
                      <td className="py-2">
                        <TrafficLight
                          status={
                            row.lateOrMissing > 0
                              ? 'AT_RISK'
                              : row.overallProgress === null
                                ? 'NO_DATA'
                                : 'ON_TRACK'
                          }
                          compact
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Director Summary Highlights"
          icon={PersonCheckIcon}
          action={{ href: '/executive-dashboard/director-summaries', label: 'View all' }}
        >
          {directorSummaries.length === 0 ? (
            <SharedEmptyState title="No Director Summaries submitted for this reporting week yet." />
          ) : (
            <div className="space-y-2">
              {directorSummaries.slice(0, 4).map((s) => (
                <Link
                  key={s.id}
                  href={`/executive-dashboard/director-summaries/${s.id}`}
                  className="block rounded-lg border border-nicta-neutral-200 p-2.5 text-xs hover:bg-nicta-neutral-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-nicta-teal-dark">{s.department.name}</span>
                    <StatusPill value={s.ceoValidationStatus} />
                  </div>
                  {s.keyAchievements && (
                    <p className="mt-1 truncate text-nicta-neutral-700">{s.keyAchievements}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>

      <div className="mt-3">
        <DashboardPanel
          title="Milestones and Critical Risks"
          icon={ChartIcon}
          action={{ href: '/executive-dashboard/performance', label: 'View all' }}
        >
          {milestones.length === 0 ? (
            <SharedEmptyState title="No milestones have been set yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs">
                <thead className="border-b border-nicta-neutral-200 text-[10px] uppercase tracking-wide text-nicta-neutral-700">
                  <tr>
                    <th className="pb-2 font-semibold">Item</th>
                    <th className="pb-2 font-semibold">Owner</th>
                    <th className="pb-2 font-semibold">Department</th>
                    <th className="pb-2 font-semibold">Due date</th>
                    <th className="pb-2 font-semibold">Progress</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nicta-neutral-200">
                  {milestones.slice(0, 6).map((m) => (
                    <tr key={m.id}>
                      <td className="max-w-[200px] truncate py-2 pr-3 font-medium text-nicta-neutral-900">
                        {m.title}
                      </td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">{m.responsibleDirectorName}</td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">{m.departmentName}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-nicta-neutral-700">
                        {formatDate(m.dueDate)}
                      </td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">{m.progressPercent}%</td>
                      <td className="py-2 pr-3">
                        <TrafficLight status={m.status} compact />
                      </td>
                      <td className="py-2 text-right">
                        <SmallLink href={`/executive-dashboard/performance/milestones/${m.id}`}>
                          {m.validationStatus === 'AWAITING_CEO_VALIDATION' ? 'Validate' : 'View'}
                        </SmallLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardPanel>
      </div>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[1.35fr_0.65fr]">
        <DashboardPanel
          title="Approval Inbox"
          icon={InboxIcon}
          badge={approvalInbox.length}
          action={{ href: '/executive-dashboard/approvals', label: 'View all' }}
        >
          {approvalInbox.length === 0 ? (
            <EmptyState>No items are currently awaiting your approval.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-nicta-neutral-200 text-[10px] uppercase tracking-wide text-nicta-neutral-700">
                  <tr>
                    <th className="pb-2 font-semibold">Reference</th>
                    <th className="pb-2 font-semibold">Title</th>
                    <th className="pb-2 font-semibold">From</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nicta-neutral-200">
                  {approvalInbox.slice(0, 6).map((item) => (
                    <tr
                      key={`${item.referenceNumber}-${item.id}`}
                      className={
                        item.id === selectedSubmission?.id ? 'bg-nicta-teal-light/60' : undefined
                      }
                    >
                      <td className="whitespace-nowrap py-2 pr-3 font-semibold text-nicta-teal">
                        {item.referenceNumber}
                      </td>
                      <td className="max-w-[270px] py-2 pr-3">
                        <p className="truncate font-medium text-nicta-neutral-900">{item.title}</p>
                        <p className="truncate text-[10px] text-nicta-neutral-700">
                          {item.documentType}
                        </p>
                      </td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">
                        {item.originatingDepartment}
                      </td>
                      <td className="py-2 pr-3">
                        <StatusPill value={item.status} />
                      </td>
                      <td className="py-2 text-right">
                        <SmallLink href={item.linkUrl}>Review</SmallLink>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel title="Approval Actions" icon={ShieldCheckIcon}>
          {!selectedSubmission ? (
            <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-nicta-neutral-200 bg-nicta-neutral-50 px-5 text-center">
              <InboxIcon className="h-7 w-7 text-nicta-neutral-700" />
              <p className="mt-2 text-sm font-medium text-nicta-teal-dark">
                Select an SMC submission
              </p>
              <p className="mt-1 text-xs text-nicta-neutral-700">
                Choose Review in the inbox to record your Board-vetting decision.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-nicta-teal">
                {selectedSubmission.referenceNumber}
              </p>
              <p className="mt-1 text-sm font-semibold text-nicta-teal-dark">
                {selectedSubmission.title}
              </p>
              <p className="mt-1 text-xs text-nicta-neutral-700">{selectedSubmission.paperType}</p>
              {canVet && boundVet && boundNotVet ? (
                <div className="mt-3">
                  <CeoVettingForm onVetForBoard={boundVet} onNotVetForBoard={boundNotVet} />
                  <div className="mt-3">
                    <ComingSoonBadge label="Digital signature" />
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-xs text-nicta-neutral-700">
                  This submission is no longer awaiting a CEO decision.{' '}
                  <Link
                    href={`/submissions/${selectedSubmission.id}`}
                    className="font-semibold text-nicta-teal hover:underline"
                  >
                    View paper
                  </Link>
                </p>
              )}
            </div>
          )}
        </DashboardPanel>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1.25fr_0.75fr]">
        <DashboardPanel title="SMC Submission Overview" icon={DocumentIcon}>
          {submissionDepartmentRows.length === 0 ? (
            <EmptyState>No SMC submissions yet.</EmptyState>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {submissionDepartmentRows.map((row) => (
                <div
                  key={row.name}
                  className="rounded-lg border border-nicta-neutral-200 bg-nicta-neutral-50 p-3"
                >
                  <p className="truncate text-xs font-semibold text-nicta-teal-dark">{row.name}</p>
                  <div className="mt-2 flex items-center gap-4 text-[11px] text-nicta-neutral-700">
                    <span>
                      <strong className="text-nicta-teal-dark">{row.submitted}</strong> submitted
                    </span>
                    <span>
                      <strong className="text-nicta-teal-dark">{row.vetted}</strong> vetted
                    </span>
                    <span className={row.late > 0 ? 'text-status-danger' : undefined}>
                      <strong>{row.late}</strong> late
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel title="Quick Actions" icon={BellIcon}>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction
              href="/executive-dashboard/approvals"
              icon={InboxIcon}
              label="Review approvals"
            />
            <QuickAction
              href="/executive-dashboard/comments"
              icon={DocumentIcon}
              label="Add CEO comment"
            />
            <QuickAction href="/delegations" icon={PeopleIcon} label="Delegate task" />
            <QuickAction
              href="/executive-dashboard/performance"
              icon={ChartIcon}
              label="View executive report"
            />
          </div>
        </DashboardPanel>
      </div>
    </PortalShell>
  );
}

function DashboardPanel({
  title,
  icon: Icon,
  badge,
  action,
  children,
}: {
  title: string;
  icon: typeof ChartIcon;
  badge?: number;
  action?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-nicta-neutral-200 bg-white shadow-[0_2px_8px_rgba(21,60,68,0.04)]">
      <div className="flex min-h-11 items-center justify-between border-b border-nicta-neutral-200 px-3.5 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-nicta-teal-dark">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-nicta-teal-dark text-white">
            <Icon className="h-3.5 w-3.5" />
          </span>
          {title}
          {badge !== undefined && badge > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-nicta-teal px-1.5 text-[10px] font-bold text-white">
              {badge}
            </span>
          )}
        </h2>
        {action && (
          <Link
            href={action.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-nicta-teal hover:underline"
          >
            {action.label}
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <div className="p-3.5">{children}</div>
    </section>
  );
}

function ProgressBar({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <span
      className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-nicta-neutral-200"
      aria-label={`${value}% complete`}
    >
      <span
        className={`block h-full rounded-full ${muted ? 'bg-nicta-neutral-200' : 'bg-nicta-teal-dark'}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </span>
  );
}

function RiskStatusPill({ status }: { status: DepartmentPerformance['status'] }) {
  const tones = {
    ON_TRACK: 'bg-status-success-bg text-status-success',
    AT_RISK: 'bg-status-warning-bg text-status-warning',
    CRITICAL: 'bg-status-danger-bg text-status-danger',
    NO_DATA: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  };
  return (
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium ${tones[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {RISK_STATUS_LABEL[status]}
    </span>
  );
}

function StatusPill({ value }: { value: string }) {
  const normalized = value.toUpperCase();
  const tone =
    normalized.includes('OVERDUE') || normalized.includes('CRITICAL')
      ? 'bg-status-danger-bg text-status-danger'
      : normalized.includes('RISK') || normalized.includes('AWAITING')
        ? 'bg-status-warning-bg text-status-warning'
        : normalized.includes('READY') || normalized.includes('COMPLETE')
          ? 'bg-status-success-bg text-status-success'
          : 'bg-nicta-teal-light text-nicta-teal';
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-medium ${tone}`}>
      {humanizeStatus(value)}
    </span>
  );
}

function DelegationStatusPill({ delegation }: { delegation: DelegationRow }) {
  return <StatusPill value={delegation.status} />;
}

function SmallLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex rounded border border-nicta-teal px-2.5 py-1 text-[10px] font-semibold text-nicta-teal transition-colors hover:bg-nicta-teal hover:text-white"
    >
      {children}
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof ChartIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center gap-2 rounded-md border border-nicta-teal px-3 py-2 text-[11px] font-medium text-nicta-teal-dark transition-colors hover:bg-nicta-teal-light"
    >
      <Icon className="h-4 w-4 shrink-0 text-nicta-teal" />
      {label}
    </Link>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-xs text-nicta-neutral-700">{children}</p>;
}

type DepartmentRow = { name: string; submitted: number; late: number; vetted: number };

function summarizeByDepartment(smcSubmissions: SubmissionWithDepartment[]): DepartmentRow[] {
  const byDepartment = new Map<string, DepartmentRow>();
  for (const submission of smcSubmissions) {
    const name = submission.department.name;
    const row = byDepartment.get(name) ?? { name, submitted: 0, late: 0, vetted: 0 };
    row.submitted += 1;
    if (submission.isLate) row.late += 1;
    if (submission.endorsedForBoard) row.vetted += 1;
    byDepartment.set(name, row);
  }
  return Array.from(byDepartment.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function departmentProgress(row: DepartmentPerformance): number | null {
  const values = [row.kpiPercent, row.kraPercent].filter(
    (value): value is number => value !== null,
  );
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function delegationProgress(status: string): number {
  const progressByStatus: Record<string, number> = {
    DRAFT: 5,
    ISSUED: 15,
    ACKNOWLEDGED: 25,
    IN_PROGRESS: 55,
    AT_RISK: 45,
    SUBMITTED_FOR_REVIEW: 85,
    RETURNED_FOR_MORE_WORK: 65,
    COMPLETED: 100,
    CLOSED: 100,
    CANCELLED: 0,
  };
  return progressByStatus[status] ?? 0;
}

function humanizeStatus(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value}%`;
}

function formatDate(date: Date): string {
  return DateTime.fromJSDate(date).setZone('Pacific/Port_Moresby').toFormat('d MMM yyyy');
}

async function loadSelectedSubmission(id: string | undefined, user: AuthenticatedUser) {
  if (!id) return null;
  try {
    return await getSubmissionForUser(id, user);
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    return null;
  }
}
