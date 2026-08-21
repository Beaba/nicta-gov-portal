import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listReviewQueue } from '@/lib/submissions/submissions';
import { AppHeader } from '@/components/AppHeader';
import { StatusBadge } from '@/components/StatusBadge';

export default async function ReviewQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (
    !user.roles.some((r) => r.roleCode === 'REVIEWER_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN')
  )
    redirect('/');

  const submissions = await listReviewQueue(user);

  return (
    <>
      <AppHeader user={user} active="review-queue" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-[11px] font-bold uppercase tracking-wider text-nicta-turquoise">
          Corporate Services Director
        </p>
        <h1 className="mt-1 text-3xl font-medium text-nicta-teal-dark">Review Queue</h1>
        <p className="mt-1 text-sm text-nicta-neutral-700">
          Papers submitted to SMC awaiting your review.
        </p>

        <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white">
          {submissions.length === 0 ? (
            <p className="p-5 text-sm text-nicta-neutral-700">
              No submissions are awaiting review.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
                <tr>
                  <th className="px-5 py-2 font-semibold">Reference</th>
                  <th className="px-5 py-2 font-semibold">Paper Title</th>
                  <th className="px-5 py-2 font-semibold">Approved Format</th>
                  <th className="px-5 py-2 font-semibold">Submitted</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-nicta-neutral-200 last:border-0 hover:bg-nicta-teal-light"
                  >
                    <td className="px-5 py-3">
                      <Link
                        href={`/review-queue/${s.id}`}
                        className="font-semibold text-nicta-teal hover:underline"
                      >
                        {s.referenceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{s.title}</td>
                    <td className="px-5 py-3 text-nicta-teal">{s.paperType}</td>
                    <td className="px-5 py-3 text-nicta-neutral-700">
                      {s.submittedAt?.toLocaleDateString() ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge submission={s} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
