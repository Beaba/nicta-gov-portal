import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getSubmissionForUser } from '@/lib/submissions/submissions';
import { prisma } from '@/lib/db/prisma';
import { AppHeader } from '@/components/AppHeader';
import { AuthorizationError } from '@/lib/auth/rbac';

export default async function AIReviewPage({ params }: { params: { id: string } }) {
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

  const results = await prisma.aIReviewResult.findMany({
    where: { submissionId: submission.id },
    orderBy: { reviewedAt: 'desc' },
  });

  return (
    <>
      <AppHeader user={user} active="submissions" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Link
          href={`/submissions/${submission.id}`}
          className="text-sm text-nicta-teal hover:underline"
        >
          ← Back to submission
        </Link>
        <h1 className="mt-2 text-lg font-semibold text-nicta-teal-dark">
          AI Template Review — {submission.referenceNumber}
        </h1>
        <p className="mt-1 text-sm text-nicta-neutral-700">
          Advisory only. The AI never approves, rejects, or routes a submission — a human reviewer
          makes that decision.
        </p>

        {results.length === 0 ? (
          <p className="mt-6 text-sm text-nicta-neutral-700">
            No AI review has run yet — submit the paper to trigger one.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {results.map((r) => (
              <article
                key={r.id}
                className="rounded-md border border-nicta-neutral-200 bg-white p-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-medium">{r.overallResult.replace(/_/g, ' ')}</h2>
                  <span className="text-xs text-nicta-neutral-700">
                    {r.reviewedAt.toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-nicta-neutral-700">
                  Provider: {r.providerMode}
                  {r.modelIdentifier ? ` (${r.modelIdentifier})` : ''} · Human review status:{' '}
                  {r.humanReviewStatus}
                </p>

                <FindingList title="Missing Sections" items={JSON.parse(r.missingSections)} />
                <FindingList title="Warnings" items={JSON.parse(r.warnings)} />
                <FindingList
                  title="Suggested Corrections"
                  items={JSON.parse(r.suggestedCorrections)}
                />
                <FindingList
                  title="Source References"
                  items={r.sourceReferences ? JSON.parse(r.sourceReferences) : []}
                />
              </article>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function FindingList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-nicta-neutral-700">
        {title}
      </h3>
      <ul className="mt-1 list-inside list-disc text-sm text-nicta-neutral-900">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
