import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { listActiveTemplates } from '@/lib/templates/templates';
import { AppHeader } from '@/components/AppHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { NewSubmissionModal } from '@/components/NewSubmissionModal';

export default async function MySubmissionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'SUBMITTER')) redirect('/');

  const [submissions, templates] = await Promise.all([
    prisma.submission.findMany({
      where: { createdById: user.id },
      include: { department: true },
      orderBy: { createdAt: 'desc' },
    }),
    listActiveTemplates(),
  ]);

  return (
    <>
      <AppHeader user={user} active="submissions" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-[11px] font-bold uppercase tracking-wider text-nicta-turquoise">
          Senior Management Committee
        </p>
        <div className="mt-1 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-medium text-nicta-teal-dark">SMC Submissions</h1>
            <p className="mt-1 text-sm text-nicta-neutral-700">
              Upload a completed paper using an approved NICTA template.
            </p>
          </div>
          <NewSubmissionModal templates={templates} variant="button" />
        </div>

        <NewSubmissionModal templates={templates} variant="banner" />

        <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="font-semibold text-nicta-teal-dark">SMC Submission Register</h2>
            <span className="rounded-full bg-status-info-bg px-3 py-1 text-xs text-status-info">
              Current meeting
            </span>
          </div>

          {submissions.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-nicta-neutral-700">
              You have not created any submissions yet. Use &ldquo;Start submission&rdquo; above.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
                <tr>
                  <th className="px-5 py-2 font-semibold">Reference</th>
                  <th className="px-5 py-2 font-semibold">Paper Title</th>
                  <th className="px-5 py-2 font-semibold">Approved Format</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                  <th className="px-5 py-2 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr key={s.id} className="border-b border-nicta-neutral-200 last:border-0">
                    <td className="px-5 py-3 font-semibold text-nicta-teal">{s.referenceNumber}</td>
                    <td className="px-5 py-3">
                      <p className="font-semibold text-nicta-teal-dark">{s.title}</p>
                      <p className="text-xs text-nicta-neutral-700">{s.department.name}</p>
                    </td>
                    <td className="px-5 py-3 text-nicta-teal">{s.paperType}</td>
                    <td className="px-5 py-3">
                      <StatusBadge submission={s} />
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/submissions/${s.id}`}
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
      </main>
    </>
  );
}
