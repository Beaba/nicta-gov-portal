import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listRecentBoardComments } from '@/lib/board/comments';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';

const ENTITY_LABEL: Record<string, string> = {
  Submission: 'Board Paper',
  Resolution: 'Resolution',
  MeetingMinutes: 'Minutes',
};

export default async function BoardCommentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isBoard = user.roles.some(
    (r) =>
      r.roleCode === 'BOARD_MEMBER' ||
      r.roleCode === 'BOARD_SECRETARIAT' ||
      r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isBoard) redirect('/');

  const comments = await listRecentBoardComments(user);

  const authorIds = Array.from(new Set(comments.map((c) => c.authorId)));
  const authors = authorIds.length
    ? await prisma.user.findMany({ where: { id: { in: authorIds } } })
    : [];
  const nameById = new Map(authors.map((a) => [a.id, a.name]));

  const submissionIds = comments
    .filter((c) => c.entityType === 'Submission')
    .map((c) => c.entityId);
  const resolutionIds = comments
    .filter((c) => c.entityType === 'Resolution')
    .map((c) => c.entityId);
  const [submissions, resolutions] = await Promise.all([
    submissionIds.length
      ? prisma.submission.findMany({ where: { id: { in: submissionIds } } })
      : [],
    resolutionIds.length
      ? prisma.resolution.findMany({ where: { id: { in: resolutionIds } } })
      : [],
  ]);
  const submissionById = new Map(submissions.map((s) => [s.id, s]));
  const resolutionById = new Map(resolutions.map((r) => [r.id, r]));

  function linkFor(entityType: string, entityId: string): { title: string; href: string } {
    if (entityType === 'Submission') {
      const s = submissionById.get(entityId);
      return {
        title: s ? `${s.referenceNumber} — ${s.title}` : 'Board Paper',
        href: `/submissions/${entityId}`,
      };
    }
    if (entityType === 'Resolution') {
      const r = resolutionById.get(entityId);
      return {
        title: r ? `${r.resolutionNumber} — ${r.subject}` : 'Resolution',
        href: `/board/resolutions/${entityId}`,
      };
    }
    return { title: 'Meeting minutes', href: '/board/minutes' };
  }

  return (
    <PortalShell user={user} active="board-comments">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Comments</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Recent comments across Board papers, resolutions and minutes.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <section className="mt-6 space-y-3">
        {comments.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-sm text-nicta-neutral-700 shadow-sm">
            No comments yet.
          </p>
        ) : (
          comments.map((c) => {
            const target = linkFor(c.entityType, c.entityId);
            return (
              <div key={c.id} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-nicta-teal-light px-2.5 py-1 text-[11px] font-bold text-nicta-teal-dark">
                      {ENTITY_LABEL[c.entityType] ?? c.entityType}
                    </span>
                    {c.visibility === 'BOARD_ONLY' && (
                      <span className="rounded-full bg-status-warning-bg px-2 py-0.5 text-[10px] font-bold uppercase text-status-warning">
                        Board-only
                      </span>
                    )}
                    {c.isResolved && (
                      <span className="rounded-full bg-status-success-bg px-2 py-0.5 text-[10px] font-bold uppercase text-status-success">
                        Resolved
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-nicta-neutral-700">
                    {c.createdAt.toLocaleString()}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-nicta-teal-dark">
                  {nameById.get(c.authorId) ?? 'Unknown'}
                </p>
                <p className="mt-1 text-sm text-nicta-neutral-900">{c.body}</p>
                <Link
                  href={target.href}
                  className="mt-2 inline-block text-xs font-semibold text-nicta-teal hover:underline"
                >
                  {target.title} →
                </Link>
              </div>
            );
          })
        )}
      </section>
    </PortalShell>
  );
}
