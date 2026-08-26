import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listResolutionsForUser } from '@/lib/board/resolutions';
import { PortalShell } from '@/components/PortalShell';

export default async function BoardResolutionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isBoard = user.roles.some(
    (r) =>
      r.roleCode === 'BOARD_MEMBER' ||
      r.roleCode === 'BOARD_SECRETARIAT' ||
      r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isBoard) redirect('/');

  const resolutions = await listResolutionsForUser(user);

  return (
    <PortalShell user={user} active="board-resolutions">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Board Resolutions</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Searchable register of resolutions across all Board meetings.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        {resolutions.length === 0 ? (
          <p className="px-5 py-6 text-sm text-nicta-neutral-700">No resolutions recorded yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Resolution</th>
                <th className="px-5 py-2 font-semibold">Meeting</th>
                <th className="px-5 py-2 font-semibold">Responsible</th>
                <th className="px-5 py-2 font-semibold">Due</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {resolutions.map((r) => (
                <tr key={r.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-semibold text-nicta-teal-dark">{r.resolutionNumber}</p>
                    <p className="text-xs text-nicta-neutral-700">{r.subject}</p>
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{r.meeting.title}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {r.responsibleDepartment?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {r.dueDate?.toLocaleDateString() ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-nicta-teal-light px-2.5 py-1 text-[11px] font-bold text-nicta-teal-dark">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/board/resolutions/${r.id}`}
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
