import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listBoardPapers } from '@/lib/submissions/review';
import { AppHeader } from '@/components/AppHeader';
import { StatusBadge } from '@/components/StatusBadge';

export default async function BoardPapersPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (
    !user.roles.some(
      (r) =>
        r.roleCode === 'SUBMITTER' ||
        r.roleCode === 'REVIEWER_SECRETARIAT' ||
        r.roleCode === 'EXECUTIVE_VIEWER' ||
        r.roleCode === 'SYSTEM_ADMIN',
    )
  ) {
    redirect('/');
  }

  const papers = await listBoardPapers();

  return (
    <>
      <AppHeader user={user} active="board-papers" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-[11px] font-bold uppercase tracking-wider text-nicta-turquoise">
          Board Secretariat
        </p>
        <h1 className="mt-1 text-3xl font-medium text-nicta-teal-dark">Board Papers</h1>
        <p className="mt-1 text-sm text-nicta-neutral-700">
          SEMC papers endorsed for Board, with the Director&rsquo;s submitted Board Paper.
        </p>

        <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="font-semibold text-nicta-teal-dark">Board Papers Register</h2>
            <span className="rounded-full bg-status-info-bg px-3 py-1 text-xs text-status-info">
              Submitted papers only
            </span>
          </div>

          {papers.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-nicta-neutral-700">
              No Board Papers have been submitted yet.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
                <tr>
                  <th className="px-5 py-2 font-semibold">Board Ref</th>
                  <th className="px-5 py-2 font-semibold">Paper Title</th>
                  <th className="px-5 py-2 font-semibold">SMC Reference</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                  <th className="px-5 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {papers.map((p) => (
                  <tr key={p.id} className="border-b border-nicta-neutral-200 last:border-0">
                    <td className="px-5 py-3 font-semibold text-nicta-teal-dark">
                      {p.referenceNumber}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-nicta-teal-dark">{p.title}</p>
                      <p className="text-xs text-nicta-neutral-700">{p.paperType}</p>
                    </td>
                    <td className="px-5 py-3 text-nicta-teal">
                      {p.smcSourceSubmission?.referenceNumber ?? '—'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge submission={p} />
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/submissions/${p.id}`}
                        className="text-sm font-semibold text-nicta-teal hover:underline"
                      >
                        View paper
                      </Link>
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
