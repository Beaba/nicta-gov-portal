import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listAllSubmissions } from '@/lib/submissions/review';
import { AppHeader } from '@/components/AppHeader';
import { StatusBadge } from '@/components/StatusBadge';
import type { Submission } from '@prisma/client';

// CEO ("reviews and reads") — client requirement, docs/mvp-directors-portal-plan.md#A18.
// Org-wide, read-only: every SMC submission and Board Paper, regardless of department.
export default async function ExecutiveDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER')) redirect('/');

  const submissions = await listAllSubmissions(user);
  const smcPapers = submissions.filter((s) => s.submissionCategory === 'SMC');
  const boardPapers = submissions.filter((s) => s.submissionCategory === 'BOARD');
  const awaitingBoardPaper = smcPapers.filter(
    (s) => s.endorsedForBoard && !boardPapers.some((b) => b.smcSourceSubmissionId === s.id),
  );

  return (
    <>
      <AppHeader user={user} active="executive-dashboard" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-[11px] font-bold uppercase tracking-wider text-nicta-turquoise">
          Office of the CEO
        </p>
        <h1 className="mt-1 text-3xl font-medium text-nicta-teal-dark">Executive Dashboard</h1>
        <p className="mt-1 text-sm text-nicta-neutral-700">
          Organisation-wide view of SMC Submissions and Board Papers.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatTile label="SMC Papers" value={smcPapers.length} />
          <StatTile label="Board Papers" value={boardPapers.length} />
          <StatTile label="Awaiting Board Paper" value={awaitingBoardPaper.length} />
        </div>

        <SubmissionRegister title="SMC Submissions" papers={smcPapers} />
        <SubmissionRegister title="Board Papers" papers={boardPapers} />
      </main>
    </>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-nicta-neutral-200 bg-white p-4">
      <p className="text-2xl font-semibold text-nicta-teal-dark">{value}</p>
      <p className="text-xs uppercase tracking-wide text-nicta-neutral-700">{label}</p>
    </div>
  );
}

function SubmissionRegister({ title, papers }: { title: string; papers: Submission[] }) {
  return (
    <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white">
      <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">{title}</h2>
      {papers.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-nicta-neutral-700">None yet.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
            <tr>
              <th className="px-5 py-2 font-semibold">Reference</th>
              <th className="px-5 py-2 font-semibold">Paper Title</th>
              <th className="px-5 py-2 font-semibold">Type</th>
              <th className="px-5 py-2 font-semibold">Status</th>
              <th className="px-5 py-2 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {papers.map((p) => (
              <tr key={p.id} className="border-b border-nicta-neutral-200 last:border-0">
                <td className="px-5 py-3 font-semibold text-nicta-teal">{p.referenceNumber}</td>
                <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{p.title}</td>
                <td className="px-5 py-3 text-nicta-teal">{p.paperType}</td>
                <td className="px-5 py-3">
                  <StatusBadge submission={p} />
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/submissions/${p.id}`}
                    className="text-sm font-semibold text-nicta-teal hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
