import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getSubmissionForUser } from '@/lib/submissions/submissions';
import { listActionItems } from '@/lib/submissions/review';
import { previewRoutingDestination } from '@/lib/submissions/routing';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';
import { StatusBadge } from '@/components/StatusBadge';
import { BoardPaperModal } from '@/components/BoardPaperModal';
import { ActionItemsSection } from '@/components/ActionItemsSection';
import {
  uploadMainDocumentAction,
  uploadAnnexureAction,
  submitSubmissionAction,
} from '@/app/submissions/[id]/actions';
import { AuthorizationError } from '@/lib/auth/rbac';

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  let submission;
  try {
    submission = await getSubmissionForUser(params.id, user);
  } catch (err) {
    if (err instanceof AuthorizationError) redirect('/');
    throw err;
  }
  if (!submission) notFound();

  const [
    department,
    meeting,
    annexures,
    latestAIReview,
    latestReview,
    routingPreview,
    boardSubmission,
    sourceSubmission,
    actionItems,
  ] = await Promise.all([
    prisma.department.findUnique({ where: { id: submission.departmentId } }),
    submission.meetingId
      ? prisma.meeting.findUnique({ where: { id: submission.meetingId } })
      : null,
    prisma.submissionAnnexure.findMany({
      where: { submissionId: submission.id },
      orderBy: { order: 'asc' },
    }),
    prisma.aIReviewResult.findFirst({
      where: { submissionId: submission.id },
      orderBy: { reviewedAt: 'desc' },
    }),
    prisma.submissionReview.findFirst({
      where: { submissionId: submission.id },
      orderBy: { createdAt: 'desc' },
    }),
    submission.workflowStatus === 'ACCEPTED' || submission.workflowStatus === 'ROUTED'
      ? previewRoutingDestination(submission)
      : null,
    prisma.submission.findFirst({ where: { smcSourceSubmissionId: submission.id } }),
    submission.smcSourceSubmissionId
      ? prisma.submission.findUnique({ where: { id: submission.smcSourceSubmissionId } })
      : null,
    listActionItems(submission.id),
  ]);

  const isOwner = submission.createdById === user.id;
  const canEdit =
    isOwner && (submission.workflowStatus === 'DRAFT' || submission.workflowStatus === 'RETURNED');
  const canSubmitBoardPaper =
    isOwner &&
    submission.submissionCategory === 'SMC' &&
    submission.endorsedForBoard &&
    !boardSubmission;
  const canManageActionItems = user.roles.some(
    (r) =>
      r.roleCode === 'REVIEWER_SECRETARIAT' ||
      r.roleCode === 'SYSTEM_ADMIN' ||
      r.roleCode === 'EXECUTIVE_VIEWER',
  );
  const boundUploadMain = uploadMainDocumentAction.bind(null, submission.id);
  const boundUploadAnnexure = uploadAnnexureAction.bind(null, submission.id);
  const boundSubmit = submitSubmissionAction.bind(null, submission.id);

  return (
    <PortalShell user={user} active="submissions">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-nicta-neutral-700">{submission.referenceNumber}</p>
          <h1 className="text-2xl font-medium text-nicta-teal-dark">{submission.title}</h1>
        </div>
        <StatusBadge submission={submission} />
      </div>

      {sourceSubmission && (
        <p className="mt-2 text-sm text-nicta-neutral-700">
          Board Paper for{' '}
          <Link
            href={`/submissions/${sourceSubmission.id}`}
            className="font-semibold text-nicta-teal hover:underline"
          >
            {sourceSubmission.referenceNumber}
          </Link>
        </p>
      )}

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Paper Type" value={submission.paperType} />
        <Field label="Department" value={department?.name ?? '—'} />
        <Field
          label="Meeting"
          value={meeting ? `${meeting.title} (${meeting.meetingNumber})` : '—'}
        />
        <Field label="Confidentiality" value={submission.confidentiality} />
        <Field label="Version" value={String(submission.currentVersion)} />
        <Field
          label="Submitted"
          value={submission.submittedAt?.toLocaleString() ?? 'Not yet submitted'}
        />
      </dl>

      {submission.purpose && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-nicta-neutral-900">
            {submission.submissionCategory === 'BOARD' ? 'Board Summary' : 'Paper Description'}
          </h2>
          <p className="mt-1 text-sm text-nicta-neutral-700">{submission.purpose}</p>
        </div>
      )}

      <section className="mt-8 rounded-md border border-nicta-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Main Document</h2>
        {submission.mainDocumentFileName ? (
          <p className="mt-2 text-sm">
            <a
              href={`/api/documents/local/${submission.mainDocumentStorageKey}`}
              className="text-nicta-teal hover:underline"
            >
              {submission.mainDocumentFileName}
            </a>
          </p>
        ) : (
          <p className="mt-2 text-sm text-nicta-neutral-700">No document uploaded yet.</p>
        )}
        {canEdit && (
          <form action={boundUploadMain} className="mt-3 flex items-center gap-3">
            <input type="file" name="file" required className="text-sm" />
            <button
              type="submit"
              className="rounded-md bg-nicta-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-nicta-teal-dark"
            >
              {submission.mainDocumentFileName ? 'Replace' : 'Upload'}
            </button>
          </form>
        )}
      </section>

      {submission.submissionCategory === 'SMC' && (
        <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-neutral-900">Annexures</h2>
          {annexures.length === 0 ? (
            <p className="mt-2 text-sm text-nicta-neutral-700">No annexures uploaded.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {annexures.map((a) => (
                <li key={a.id}>
                  <a
                    href={`/api/documents/local/${a.storageKey}`}
                    className="text-nicta-teal hover:underline"
                  >
                    {a.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form action={boundUploadAnnexure} className="mt-3 flex flex-wrap items-center gap-3">
              <input
                type="text"
                name="title"
                placeholder="Annexure title"
                required
                className="input w-48"
              />
              <input type="file" name="file" required className="text-sm" />
              <button
                type="submit"
                className="rounded-md bg-nicta-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-nicta-teal-dark"
              >
                Add Annexure
              </button>
            </form>
          )}
        </section>
      )}

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
        </section>
      )}

      {latestReview && (
        <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-neutral-900">Latest Reviewer Comments</h2>
          <p className="mt-2 text-sm text-nicta-neutral-700">
            {latestReview.outcome}: {latestReview.comments ?? '—'}
          </p>
        </section>
      )}

      {routingPreview && (
        <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-neutral-900">Document Destination</h2>
          <p className="mt-2 text-sm text-nicta-neutral-700">
            {submission.workflowStatus === 'ROUTED' ? 'Routed to' : 'Will be routed to'}:{' '}
            <code className="text-xs">{submission.routingFolderKey ?? routingPreview}</code>
          </p>
        </section>
      )}

      {submission.endorsedForBoard && submission.submissionCategory === 'SMC' && (
        <section className="mt-6 rounded-md border border-status-accent/40 bg-status-accent/5 p-4">
          <p className="text-sm font-medium text-status-accent">
            Endorsed for Board on {submission.endorsedForBoardAt?.toLocaleString()}
          </p>
          {boardSubmission ? (
            <p className="mt-1 text-sm">
              Board Paper submitted:{' '}
              <Link
                href={`/submissions/${boardSubmission.id}`}
                className="font-semibold text-nicta-teal hover:underline"
              >
                {boardSubmission.referenceNumber}
              </Link>
            </p>
          ) : canSubmitBoardPaper ? (
            <div className="mt-3">
              <BoardPaperModal sourceSubmissionId={submission.id} />
            </div>
          ) : null}
        </section>
      )}

      <ActionItemsSection
        submissionId={submission.id}
        items={actionItems}
        canAdd={canManageActionItems}
      />

      <div className="mt-8 flex items-center gap-4">
        <Link
          href={`/submissions/${submission.id}/audit`}
          className="text-sm text-nicta-teal hover:underline"
        >
          View audit history →
        </Link>
        {canEdit && submission.mainDocumentStorageKey && (
          <form action={boundSubmit}>
            <button
              type="submit"
              className="rounded-md bg-status-success px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              {submission.workflowStatus === 'RETURNED' ? 'Resubmit to SMC' : 'Submit to SMC'}
            </button>
          </form>
        )}
      </div>
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
