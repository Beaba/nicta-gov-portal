import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getSubmissionForUser } from '@/lib/submissions/submissions';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';
import { StatusBadge } from '@/components/StatusBadge';
import { AuthorizationError } from '@/lib/auth/rbac';
import { returnSubmissionAction, noteSubmissionAction } from '@/app/review-queue/[id]/actions';

export default async function ReviewSubmissionPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (
    !user.roles.some((r) => r.roleCode === 'REVIEWER_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN')
  )
    redirect('/');

  let submission;
  try {
    submission = await getSubmissionForUser(params.id, user);
  } catch (err) {
    if (err instanceof AuthorizationError) redirect('/');
    throw err;
  }
  if (!submission) notFound();

  const [department, meeting, deadline, annexures, latestAIReview] = await Promise.all([
    prisma.department.findUnique({ where: { id: submission.departmentId } }),
    submission.meetingId
      ? prisma.meeting.findUnique({ where: { id: submission.meetingId } })
      : null,
    submission.meetingId
      ? prisma.deadline.findUnique({ where: { meetingId: submission.meetingId } })
      : null,
    prisma.submissionAnnexure.findMany({
      where: { submissionId: submission.id },
      orderBy: { order: 'asc' },
    }),
    prisma.aIReviewResult.findFirst({
      where: { submissionId: submission.id },
      orderBy: { reviewedAt: 'desc' },
    }),
  ]);

  const boundNote = noteSubmissionAction.bind(null, submission.id);
  const boundReturn = returnSubmissionAction.bind(null, submission.id);

  return (
    <PortalShell user={user} active="review-queue">
      <Link href="/review-queue" className="text-sm text-nicta-teal hover:underline">
        ← Back to queue
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <p className="text-sm text-nicta-neutral-700">{submission.referenceNumber}</p>
          <h1 className="text-2xl font-medium text-nicta-teal-dark">{submission.title}</h1>
        </div>
        <StatusBadge submission={submission} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Paper Type" value={submission.paperType} />
        <Field label="Department" value={department?.name ?? '—'} />
        <Field
          label="Meeting"
          value={meeting ? `${meeting.title} (${meeting.meetingNumber})` : '—'}
        />
        <Field label="Submitted" value={submission.submittedAt?.toLocaleString() ?? '—'} />
      </dl>

      {submission.isLate && (
        <div className="mt-4 rounded-md border-l-4 border-status-danger bg-status-danger-bg p-4">
          <p className="text-sm font-semibold text-status-danger">Late submission</p>
          {deadline && (
            <p className="mt-1 text-xs text-nicta-neutral-900">
              Original deadline: {deadline.normalCloseAt.toLocaleString()} — actual submission:{' '}
              {submission.submittedAt?.toLocaleString() ?? '—'}
            </p>
          )}
          {submission.lateJustification && (
            <p className="mt-2 text-sm text-nicta-neutral-900">
              <span className="font-semibold">Justification:</span> {submission.lateJustification}
            </p>
          )}
        </div>
      )}

      {submission.purpose && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-nicta-neutral-900">Paper Description</h2>
          <p className="mt-1 text-sm text-nicta-neutral-700">{submission.purpose}</p>
        </div>
      )}

      <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Documents</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {submission.mainDocumentFileName && (
            <li>
              <a
                href={`/api/documents/local/${submission.mainDocumentStorageKey}`}
                className="text-nicta-teal hover:underline"
              >
                {submission.mainDocumentFileName} (main paper)
              </a>
            </li>
          )}
          {submission.generatedDraftStorageKey && (
            <li>
              <a
                href={`/api/documents/local/${submission.generatedDraftStorageKey}`}
                className="text-nicta-teal hover:underline"
              >
                AI-generated templated draft
              </a>
            </li>
          )}
          {annexures.map((a) => (
            <li key={a.id}>
              <a
                href={`/api/documents/local/${a.storageKey}`}
                className="text-nicta-teal hover:underline"
              >
                {a.title} (annexure)
              </a>
            </li>
          ))}
        </ul>
      </section>

      {latestAIReview && (
        <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-nicta-neutral-900">AI Template Review</h2>
            <Link
              href={`/submissions/${submission.id}/ai-review`}
              className="text-sm text-nicta-teal hover:underline"
            >
              View full findings →
            </Link>
          </div>
          <p className="mt-2 text-sm">
            Overall result: <strong>{latestAIReview.overallResult.replace(/_/g, ' ')}</strong>
          </p>
          <p className="mt-1 text-xs text-nicta-neutral-700">
            Advisory only — your decision governs.
          </p>
        </section>
      )}

      {submission.endorsedForBoard && (
        <section className="mt-6 rounded-md border border-status-accent/40 bg-status-accent/5 p-4">
          <p className="text-sm font-medium text-status-accent">
            Vetted for Board by the CEO on {submission.endorsedForBoardAt?.toLocaleString()}
            {' — awaiting the Director to submit the Board Paper.'}
          </p>
        </section>
      )}

      {submission.workflowStatus === 'SECRETARIAT_REVIEW' && (
        <section className="mt-8 space-y-4">
          <p className="text-sm font-semibold text-nicta-teal-dark">
            Secretariat Completeness Check
          </p>
          <p className="text-xs text-nicta-neutral-700">
            Whether this paper proceeds to Board is the CEO&rsquo;s decision, made from the
            Executive Dashboard once accepted here — not part of this check.
          </p>

          <form
            action={boundNote}
            className="rounded-md border border-nicta-neutral-200 bg-white p-4"
          >
            <label htmlFor="note-comment" className="block text-sm font-medium">
              Accept for SMC
            </label>
            <textarea
              id="note-comment"
              name="comment"
              rows={2}
              placeholder="Optional comment"
              className="input mt-2"
            />
            <button
              type="submit"
              className="mt-3 rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Accept for SMC
            </button>
          </form>

          <form
            action={boundReturn}
            className="rounded-md border border-status-danger/40 bg-white p-4"
          >
            <label htmlFor="return-comment" className="block text-sm font-medium">
              Return for Correction
            </label>
            <textarea
              id="return-comment"
              name="comment"
              rows={2}
              required
              placeholder="Required — explain what needs to change"
              className="input mt-2"
            />
            <button
              type="submit"
              className="mt-3 rounded-md bg-status-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Return for Correction
            </button>
          </form>
        </section>
      )}
    </PortalShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-nicta-neutral-700">{label}</dt>
      <dd className="font-medium text-nicta-neutral-900">{value}</dd>
    </div>
  );
}
