import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getSubmissionForUser } from '@/lib/submissions/submissions';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';
import { AuthorizationError } from '@/lib/auth/rbac';

export default async function SubmissionAuditPage({ params }: { params: { id: string } }) {
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

  const [transitions, auditEvents] = await Promise.all([
    prisma.workflowTransition.findMany({
      where: { submissionId: submission.id },
      orderBy: { performedAt: 'asc' },
    }),
    prisma.auditEvent.findMany({
      where: { entityType: 'Submission', entityId: submission.id },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const performerIds = Array.from(new Set(transitions.map((t) => t.performedById)));
  const performers = await prisma.user.findMany({ where: { id: { in: performerIds } } });
  const nameById = new Map(performers.map((p) => [p.id, p.name]));

  return (
    <PortalShell user={user} active="submissions">
      <Link
        href={`/submissions/${submission.id}`}
        className="text-sm text-nicta-teal hover:underline"
      >
        ← Back to submission
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-nicta-teal-dark">
        Audit History — {submission.referenceNumber}
      </h1>

      <ol className="mt-6 space-y-4 border-l-2 border-nicta-neutral-200 pl-4">
        {transitions.map((t) => (
          <li key={t.id}>
            <p className="text-sm font-medium">
              {t.fromState} → {t.toState}
            </p>
            <p className="text-xs text-nicta-neutral-700">
              {nameById.get(t.performedById) ?? t.performedById} · {t.performedAt.toLocaleString()}
            </p>
            {t.comment && <p className="mt-1 text-sm text-nicta-neutral-700">{t.comment}</p>}
          </li>
        ))}
      </ol>

      <h2 className="mt-8 text-sm font-semibold text-nicta-neutral-900">Raw Audit Events</h2>
      <table className="mt-3 w-full border-collapse overflow-hidden rounded-md border border-nicta-neutral-200 bg-white text-xs">
        <thead className="bg-nicta-neutral-100 text-left text-nicta-neutral-700">
          <tr>
            <th className="px-3 py-2">Action</th>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Details</th>
          </tr>
        </thead>
        <tbody>
          {auditEvents.map((e) => (
            <tr key={e.id} className="border-t border-nicta-neutral-200">
              <td className="px-3 py-2">{e.action}</td>
              <td className="px-3 py-2 text-nicta-neutral-700">{e.createdAt.toLocaleString()}</td>
              <td className="px-3 py-2 text-nicta-neutral-700">{e.newState ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </PortalShell>
  );
}
