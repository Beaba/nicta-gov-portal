import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';

// Read-only register of ARCHIVED Board meetings — the client's "maintain the read-only Board
// archive" requirement. No edit/delete affordance exists anywhere on this page, by design: the
// only way a meeting reaches ARCHIVED is meetings/[id]/actions.ts's one-way COMPLETED -> ARCHIVED
// transition (src/lib/board/meetings.ts's TRANSITIONS graph has no path out of ARCHIVED).
export default async function BoardArchivePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isBoard = user.roles.some(
    (r) =>
      r.roleCode === 'BOARD_MEMBER' ||
      r.roleCode === 'BOARD_SECRETARIAT' ||
      r.roleCode === 'SYSTEM_ADMIN' ||
      r.roleCode === 'EXECUTIVE_VIEWER',
  );
  if (!isBoard) redirect('/');

  const meetings = await prisma.meeting.findMany({
    where: { meetingType: 'BOARD', status: 'ARCHIVED' },
    include: {
      minutes: { where: { status: 'PUBLISHED' }, orderBy: { version: 'desc' }, take: 1 },
      resolutions: true,
    },
    orderBy: { meetingDate: 'desc' },
  });

  return (
    <PortalShell user={user} active="board-archive">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Board Archive</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Read-only record of completed Board meetings, minutes and resolutions.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        {meetings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-nicta-neutral-700">No archived meetings yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Meeting</th>
                <th className="px-5 py-2 font-semibold">Date</th>
                <th className="px-5 py-2 font-semibold">Minutes</th>
                <th className="px-5 py-2 font-semibold">Resolutions</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{m.title}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {m.meetingDate.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {m.minutes.length > 0 ? 'Published' : '—'}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{m.resolutions.length}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/board/meetings/${m.id}`}
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
    </PortalShell>
  );
}
