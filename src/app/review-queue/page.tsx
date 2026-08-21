import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getSubmissionForUser, listReviewQueue } from '@/lib/submissions/submissions';
import { listAllSubmissions } from '@/lib/submissions/review';
import { getCurrentSmcMeetingWithDeadline } from '@/lib/submissions/meetings';
import { AuthorizationError } from '@/lib/auth/rbac';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { DashboardMeetingBar } from '@/components/DashboardMeetingBar';
import { StatusBadge } from '@/components/StatusBadge';
import { ReviewActionForm } from '@/components/ReviewActionForm';
import {
  returnSubmissionAction,
  noteSubmissionAction,
  endorseForBoardAction,
} from '@/app/review-queue/[id]/actions';
import {
  SearchIcon,
  ClockIcon,
  UndoIcon,
  ShieldCheckIcon,
  PlusIcon,
  SettingsIcon,
} from '@/components/icons';
import type { Submission } from '@prisma/client';

export default async function ReviewQueuePage({
  searchParams,
}: {
  searchParams: { selected?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (
    !user.roles.some((r) => r.roleCode === 'REVIEWER_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN')
  )
    redirect('/');

  // queue = the awaiting-review set (SECRETARIAT_REVIEW only); allSubmissions is the broader,
  // unfiltered set the stat cards need for Late/Returned/Vetted counts (listReviewQueue can't
  // answer those — it only ever returns SECRETARIAT_REVIEW rows).
  const [queue, allSubmissions, meeting, selectedSubmission] = await Promise.all([
    listReviewQueue(user),
    listAllSubmissions(user),
    getCurrentSmcMeetingWithDeadline(),
    loadSelectedSubmission(searchParams.selected, user),
  ]);

  const lateCount = allSubmissions.filter((s) => s.isLate).length;
  const returnedCount = allSubmissions.filter((s) => s.workflowStatus === 'RETURNED').length;
  const vettedCount = allSubmissions.filter((s) => s.endorsedForBoard).length;

  const canAct = selectedSubmission?.workflowStatus === 'SECRETARIAT_REVIEW';
  const boundReturn = selectedSubmission
    ? returnSubmissionAction.bind(null, selectedSubmission.id)
    : undefined;
  const boundNote = selectedSubmission
    ? noteSubmissionAction.bind(null, selectedSubmission.id)
    : undefined;
  const boundEndorse = selectedSubmission
    ? endorseForBoardAction.bind(null, selectedSubmission.id)
    : undefined;

  return (
    <PortalShell user={user} active="review-queue">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Corporate Secretariat Dashboard</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">SMC submission review and Board routing</p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-md bg-nicta-teal-dark px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0c2e35]"
        >
          <PlusIcon className="h-4 w-4" />
          Set SMC Deadline
        </Link>
        <Link
          href="/admin/templates"
          className="inline-flex items-center gap-2 rounded-md border border-nicta-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-50"
        >
          <SettingsIcon className="h-4 w-4" />
          Manage Approved Templates
        </Link>
      </div>

      <DashboardMeetingBar
        meetingDate={meeting?.meetingDate ?? null}
        submissionsCloseAt={meeting?.deadline?.normalCloseAt ?? null}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard label="Awaiting Review" value={queue.length} icon={SearchIcon} />
        <DashboardStatCard label="Late Submissions" value={lateCount} icon={ClockIcon} />
        <DashboardStatCard label="Returned" value={returnedCount} icon={UndoIcon} />
        <DashboardStatCard label="Vetted for Board" value={vettedCount} icon={ShieldCheckIcon} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-xl bg-white shadow-sm">
          <div className="p-5 pb-3">
            <h2 className="font-semibold text-nicta-teal-dark">SMC Review Queue</h2>
          </div>

          {queue.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-nicta-neutral-700">
              No submissions are awaiting review.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
                <tr>
                  <th className="px-5 py-2 font-semibold">Reference</th>
                  <th className="px-5 py-2 font-semibold">Department</th>
                  <th className="px-5 py-2 font-semibold">Paper title</th>
                  <th className="px-5 py-2 font-semibold">Submitted</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                  <th className="px-5 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((s) => (
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
                    <td className="px-5 py-3 text-nicta-neutral-700">
                      {s.submittedAt?.toLocaleDateString() ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge submission={s} />
                    </td>
                    <td className="px-5 py-3">
                      {s.workflowStatus === 'SECRETARIAT_REVIEW' ? (
                        <Link
                          href={`/review-queue?selected=${s.id}`}
                          className="font-semibold text-nicta-teal hover:underline"
                        >
                          Review
                        </Link>
                      ) : (
                        <Link
                          href={`/review-queue/${s.id}`}
                          className="font-semibold text-nicta-teal hover:underline"
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="h-fit rounded-xl bg-white p-5 shadow-sm">
          <h2 className="font-semibold text-nicta-teal-dark">Review Actions</h2>

          {!selectedSubmission ? (
            <p className="mt-4 text-sm text-nicta-neutral-700">
              Select a submission from the queue to review it.
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

              {canAct && boundReturn && boundNote && boundEndorse ? (
                <ReviewActionForm
                  onReturn={boundReturn}
                  onNote={boundNote}
                  onEndorse={boundEndorse}
                />
              ) : (
                <p className="text-sm text-nicta-neutral-700">
                  This submission has already been reviewed.{' '}
                  <Link
                    href={`/review-queue/${selectedSubmission.id}`}
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
    </PortalShell>
  );
}

// Backs the "Review Actions" side panel's master-detail selection (?selected={id}, read from
// searchParams). Mirrors review-queue/[id]/page.tsx's getSubmissionForUser + AuthorizationError
// handling, but this is an optional query-param-driven selection on a shared dashboard, not a
// dedicated route — a bad id (no access, or simply stale/deleted) must never redirect or crash
// the whole page, only leave the panel showing its placeholder state.
async function loadSelectedSubmission(
  id: string | undefined,
  user: AuthenticatedUser,
): Promise<Submission | null> {
  if (!id) return null;
  try {
    return await getSubmissionForUser(id, user);
  } catch (err) {
    if (err instanceof AuthorizationError) return null;
    return null;
  }
}
