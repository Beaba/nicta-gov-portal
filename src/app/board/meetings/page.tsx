import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listMeetingsForUser } from '@/lib/board/meetings';
import { PortalShell } from '@/components/PortalShell';
import { NewBoardMeetingModal } from '@/components/NewBoardMeetingModal';

const STATUS_TONES: Record<string, string> = {
  DRAFT: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  PUBLISHED: 'bg-status-warning-bg text-status-warning',
  IN_PROGRESS: 'bg-status-warning-bg text-status-warning',
  COMPLETED: 'bg-status-success-bg text-status-success',
  ARCHIVED: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  CANCELLED: 'bg-status-danger-bg text-status-danger',
};

export default async function BoardMeetingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isSecretariat = user.roles.some(
    (r) => r.roleCode === 'BOARD_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN',
  );
  const isBoard = user.roles.some(
    (r) =>
      r.roleCode === 'BOARD_MEMBER' ||
      r.roleCode === 'BOARD_SECRETARIAT' ||
      r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isBoard) redirect('/');

  const meetings = await listMeetingsForUser(user);

  return (
    <PortalShell user={user} active="board-meetings">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nicta-teal-dark">Board Meetings</h1>
          <p className="mt-1 text-sm text-nicta-neutral-700">
            {isSecretariat
              ? 'Schedule meetings, prepare agendas and manage the Board pack.'
              : 'Published Board meetings and their agendas.'}
          </p>
          <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />
        </div>
        {isSecretariat && <NewBoardMeetingModal />}
      </div>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        {meetings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-nicta-neutral-700">No Board meetings yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Meeting</th>
                <th className="px-5 py-2 font-semibold">Reference</th>
                <th className="px-5 py-2 font-semibold">Date</th>
                <th className="px-5 py-2 font-semibold">Venue</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{m.title}</td>
                  <td className="px-5 py-3 text-nicta-teal">{m.meetingNumber}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {m.meetingDate.toLocaleString()}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{m.venue ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONES[m.status] ?? 'bg-nicta-neutral-100 text-nicta-neutral-700'}`}
                    >
                      {m.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/board/meetings/${m.id}`}
                      className="text-sm font-semibold text-nicta-teal hover:underline"
                    >
                      {isSecretariat ? 'Manage' : 'View'}
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
