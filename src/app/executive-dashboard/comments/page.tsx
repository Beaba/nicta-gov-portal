import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listCeoComments } from '@/lib/executive/ceoComments';
import { PortalShell } from '@/components/PortalShell';

const SOURCE_LABEL: Record<string, string> = {
  SMC_VETTING: 'SMC Vetting',
  DELEGATION: 'Delegated Task',
  BOARD_PAPER: 'Board Paper',
};

export default async function ExecutiveCommentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER')) redirect('/');

  const comments = await listCeoComments(user);

  return (
    <PortalShell user={user} active="executive-comments">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">CEO Comments</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Every comment you have made on SMC vetting decisions, delegated tasks, and Board papers, in
        one feed.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <section className="mt-6 space-y-3">
        {comments.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-sm text-nicta-neutral-700 shadow-sm">
            You have not made any comments yet.
          </p>
        ) : (
          comments.map((c) => (
            <div key={`${c.source}-${c.id}`} className="rounded-xl bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-nicta-teal-light px-2.5 py-1 text-[11px] font-bold text-nicta-teal-dark">
                  {SOURCE_LABEL[c.source]}
                </span>
                <span className="text-xs text-nicta-neutral-700">
                  {c.createdAt.toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm text-nicta-neutral-900">{c.body}</p>
              <Link
                href={c.linkUrl}
                className="mt-2 inline-block text-xs font-semibold text-nicta-teal hover:underline"
              >
                {c.relatedTitle} →
              </Link>
            </div>
          ))
        )}
      </section>
    </PortalShell>
  );
}
