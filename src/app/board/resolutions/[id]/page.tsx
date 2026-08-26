import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getResolutionForUser } from '@/lib/board/resolutions';
import { PortalShell } from '@/components/PortalShell';
import { CommentThread } from '@/components/CommentThread';

export default async function BoardResolutionDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isBoard = user.roles.some(
    (r) =>
      r.roleCode === 'BOARD_MEMBER' ||
      r.roleCode === 'BOARD_SECRETARIAT' ||
      r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isBoard) redirect('/');

  const resolution = await getResolutionForUser(params.id, user);
  if (!resolution) notFound();

  return (
    <PortalShell user={user} active="board-resolutions">
      <Link href="/board/resolutions" className="text-sm text-nicta-teal hover:underline">
        ← Back to resolutions
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-nicta-neutral-700">{resolution.resolutionNumber}</p>
          <h1 className="text-2xl font-medium text-nicta-teal-dark">{resolution.subject}</h1>
        </div>
        <span className="rounded-full bg-nicta-teal-light px-3 py-1 text-xs font-bold text-nicta-teal-dark">
          {resolution.status}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Meeting" value={resolution.meeting.title} />
        <Field
          label="Responsible department"
          value={resolution.responsibleDepartment?.name ?? '—'}
        />
        <Field label="Due date" value={resolution.dueDate?.toLocaleDateString() ?? '—'} />
        <Field label="Adopted" value={resolution.adoptedAt.toLocaleDateString()} />
      </dl>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Resolution wording</h2>
        <p className="mt-1 text-sm text-nicta-neutral-700">{resolution.resolutionText}</p>
      </div>

      {resolution.submission && (
        <p className="mt-4 text-sm">
          Related paper:{' '}
          <Link
            href={`/submissions/${resolution.submission.id}`}
            className="font-semibold text-nicta-teal hover:underline"
          >
            {resolution.submission.referenceNumber} — {resolution.submission.title}
          </Link>
        </p>
      )}

      {resolution.followUpNotes && (
        <div className="mt-4 rounded-md border border-nicta-neutral-200 bg-nicta-neutral-50 p-4">
          <p className="text-sm font-semibold text-nicta-teal-dark">Follow-up notes</p>
          <p className="mt-1 text-sm text-nicta-neutral-700">{resolution.followUpNotes}</p>
        </div>
      )}

      {resolution.actionItems.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-nicta-neutral-900">Related actions</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {resolution.actionItems.map((a) => (
              <li key={a.id} className="text-nicta-neutral-700">
                {a.description} — {a.status.replace(/_/g, ' ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      <CommentThread
        entityType="Resolution"
        entityId={resolution.id}
        redirectPath={`/board/resolutions/${resolution.id}`}
        actingUser={user}
      />
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
