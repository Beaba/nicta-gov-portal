import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listAllSubmissions, listSubmissionsAwaitingCeoReview } from '@/lib/submissions/review';
import { getSubmissionForUser } from '@/lib/submissions/submissions';
import { getCurrentSmcMeetingWithDeadline } from '@/lib/submissions/meetings';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { DashboardMeetingBar } from '@/components/DashboardMeetingBar';
import { CeoVettingForm } from '@/components/CeoVettingForm';
import { ceoVetForBoardAction, ceoNotVetForBoardAction } from '@/app/executive-dashboard/actions';
import { DocumentIcon, ClockIcon, UndoIcon, ShieldCheckIcon, SearchIcon } from '@/components/icons';

type SubmissionWithDepartment = Awaited<ReturnType<typeof listAllSubmissions>>[number];

// Most recent Board Papers shown in the "Papers Vetted for Board" card before linking out to the
// full register at /board-papers.
const BOARD_PAPERS_SHOWN = 5;

// CEO ("reviews and reads") — client requirement, docs/mvp-directors-portal-plan.md#A18.
// Org-wide, read-only: every SMC submission and Board Paper, regardless of department. Rebuilt
// onto PortalShell to match the client-approved dashboard reference (#A26).
export default async function ExecutiveDashboardPage({
  searchParams,
}: {
  searchParams: { selected?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER')) redirect('/');

  const [submissions, meeting, awaitingReview, selectedSubmission] = await Promise.all([
    listAllSubmissions(user),
    getCurrentSmcMeetingWithDeadline(),
    listSubmissionsAwaitingCeoReview(user),
    loadSelectedSubmission(searchParams.selected, user),
  ]);

  const smcSubmissions = submissions.filter((s) => s.submissionCategory === 'SMC');
  const boardSubmissions = submissions.filter((s) => s.submissionCategory === 'BOARD');

  const totalSubmissions = smcSubmissions.length;
  const lateCount = smcSubmissions.filter((s) => s.isLate).length;
  const returnedCount = smcSubmissions.filter((s) => s.workflowStatus === 'RETURNED').length;
  const vettedCount = smcSubmissions.filter((s) => s.endorsedForBoard).length;

  const departmentRows = summarizeByDepartment(smcSubmissions);

  const boundVet = selectedSubmission
    ? ceoVetForBoardAction.bind(null, selectedSubmission.id)
    : undefined;
  const boundNotVet = selectedSubmission
    ? ceoNotVetForBoardAction.bind(null, selectedSubmission.id)
    : undefined;
  const canVet =
    selectedSubmission?.workflowStatus === 'ACCEPTED' ||
    selectedSubmission?.workflowStatus === 'ROUTED';

  return (
    <PortalShell user={user} active="executive-dashboard">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">CEO Dashboard</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">Organisation-wide submission overview</p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <DashboardMeetingBar
        meetingDate={meeting?.meetingDate ?? null}
        submissionsCloseAt={meeting?.deadline?.normalCloseAt ?? null}
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DashboardStatCard
          label="Awaiting Your Review"
          value={awaitingReview.length}
          icon={SearchIcon}
        />
        <DashboardStatCard label="Total Submissions" value={totalSubmissions} icon={DocumentIcon} />
        <DashboardStatCard label="Late" value={lateCount} icon={ClockIcon} />
        <DashboardStatCard label="Returned" value={returnedCount} icon={UndoIcon} />
        <DashboardStatCard label="Vetted for Board" value={vettedCount} icon={ShieldCheckIcon} />
      </div>

      {/* The CEO's own substantive Board-escalation decision (#A27) — Corporate Secretariat's
          completeness check no longer includes this power. Same ?selected={id} master-detail
          pattern as the Corporate Secretariat dashboard's Review Actions panel. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl bg-white shadow-sm">
          <div className="p-5 pb-3">
            <h2 className="font-semibold text-nicta-teal-dark">Awaiting Your Review</h2>
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
                <CeoVettingForm onVetForBoard={boundVet} onNotVetForBoard={boundNotVet} />
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
          {departmentRows.length === 0 ? (
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
                {departmentRows.map((row) => (
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
          <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">Papers Vetted for Board</h2>
          {boardSubmissions.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-nicta-neutral-700">
              No Board Papers have been submitted yet.
            </p>
          ) : (
            <ul>
              {boardSubmissions.slice(0, BOARD_PAPERS_SHOWN).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-b border-nicta-neutral-200 px-5 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-nicta-teal">{p.referenceNumber}</p>
                    <p className="truncate text-sm font-semibold text-nicta-teal-dark">{p.title}</p>
                  </div>
                  <Link
                    href={`/submissions/${p.id}`}
                    className="shrink-0 text-sm font-semibold text-nicta-teal hover:underline"
                  >
                    View
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-auto p-5 pt-3">
            <Link
              href="/board-papers"
              className="flex w-full items-center justify-center rounded-md bg-nicta-teal-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2e35]"
            >
              View all Board Papers
            </Link>
          </div>
        </section>
      </div>
    </PortalShell>
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
