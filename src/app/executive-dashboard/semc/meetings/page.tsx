import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listSemcMeetingsForUser } from '@/lib/semc/meetings';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  PUBLISHED: 'bg-status-success-bg text-status-success',
  IN_PROGRESS: 'bg-status-warning-bg text-status-warning',
  COMPLETED: 'bg-status-success-bg text-status-success',
  ARCHIVED: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  CANCELLED: 'bg-status-danger-bg text-status-danger',
};

export default async function SemcMeetingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const meetings = await listSemcMeetingsForUser(user);

  return (
    <PortalShell user={user} active="semc-deliberations">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">SEMC Deliberations</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        SEMC meetings, agendas and recorded deliberations. The CEO chairs; all Directors, the
        Corporate Secretariat, and any invited participants attend.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      {meetings.length === 0 ? (
        <div className="mt-6 rounded-xl bg-white shadow-sm">
          <EmptyState title="No SEMC meetings scheduled yet." />
        </div>
      ) : (
        <section className="mt-6 rounded-xl bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Meeting</th>
                <th className="px-5 py-2 font-semibold">Date</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => (
                <tr key={m.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{m.title}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{m.meetingDate.toLocaleDateString()}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[m.status] ?? ''}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/executive-dashboard/semc/meetings/${m.id}`} className="text-sm font-semibold text-nicta-teal hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </PortalShell>
  );
}
