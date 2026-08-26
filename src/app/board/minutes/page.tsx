import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listAllMinutesForUser } from '@/lib/board/minutes';
import { PortalShell } from '@/components/PortalShell';

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  UNDER_REVIEW: 'bg-status-warning-bg text-status-warning',
  PUBLISHED: 'bg-status-success-bg text-status-success',
};

export default async function BoardMinutesPage({ searchParams }: { searchParams: { q?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isBoard = user.roles.some(
    (r) =>
      r.roleCode === 'BOARD_MEMBER' ||
      r.roleCode === 'BOARD_SECRETARIAT' ||
      r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isBoard) redirect('/');

  const minutes = await listAllMinutesForUser(user, searchParams.q?.trim() || undefined);

  return (
    <PortalShell user={user} active="board-minutes">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Minutes</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Search historical Board meeting minutes by meeting title.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <form method="GET" className="mt-4 flex max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Search by meeting title…"
          className="input"
        />
        <button
          type="submit"
          className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Search
        </button>
      </form>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        {minutes.length === 0 ? (
          <p className="px-5 py-6 text-sm text-nicta-neutral-700">No minutes found.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Meeting</th>
                <th className="px-5 py-2 font-semibold">Version</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Uploaded</th>
                <th className="px-5 py-2 font-semibold">Published</th>
                <th className="px-5 py-2 font-semibold">Document</th>
              </tr>
            </thead>
            <tbody>
              {minutes.map((m) => (
                <tr key={m.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">
                    {m.meeting.title}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">v{m.version}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[m.status] ?? 'bg-nicta-neutral-100 text-nicta-neutral-700'}`}
                    >
                      {m.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {m.uploadedAt.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {m.publishedAt?.toLocaleDateString() ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <a
                      href={`/api/documents/local/${m.storageKey}`}
                      className="text-sm font-semibold text-nicta-teal hover:underline"
                    >
                      {m.fileName}
                    </a>
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
