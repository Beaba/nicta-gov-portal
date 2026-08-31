import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';
import { confirmBoardEscalationAction, declineBoardEscalationAction } from '@/app/executive-dashboard/semc/escalations/actions';

// #A32 — the client's two-step Board escalation model, rendered as one screen: rows where the
// Secretariat has recorded `semcEscalationRecommended` but the CEO hasn't yet confirmed
// (`endorsedForBoard`) via markEndorsedForBoard/markNotVettedForBoard.
export default async function BoardEscalationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN')) redirect('/');

  const [pending, confirmed] = await Promise.all([
    prisma.submission.findMany({
      where: { semcEscalationRecommended: true, endorsedForBoard: false },
      include: { department: true },
      orderBy: { semcEscalationRecommendedAt: 'desc' },
    }),
    prisma.submission.findMany({
      where: { semcEscalationRecommended: true, endorsedForBoard: true },
      include: { department: true },
      orderBy: { endorsedForBoardAt: 'desc' },
      take: 10,
    }),
  ]);

  return (
    <PortalShell user={user} active="semc-escalations">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Board Escalations</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        SEMC recommends escalation to the Board; the CEO confirms before a Board Paper can be
        prepared.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 text-sm font-semibold text-nicta-teal-dark">
          Pending CEO Confirmation ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <EmptyState title="No escalations awaiting CEO confirmation." />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Matter</th>
                <th className="px-5 py-2 font-semibold">Department</th>
                <th className="px-5 py-2 font-semibold">Recommended</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((s) => (
                <tr key={s.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">
                    {s.referenceNumber} — {s.title}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{s.department.name}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {s.semcEscalationRecommendedAt?.toLocaleDateString() ?? '—'}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-3">
                      <form action={confirmBoardEscalationAction.bind(null, s.id)}>
                        <button type="submit" className="text-xs font-semibold text-status-success hover:underline">
                          Confirm Escalation
                        </button>
                      </form>
                      <details>
                        <summary className="cursor-pointer text-xs font-semibold text-status-danger">Decline</summary>
                        <form action={declineBoardEscalationAction.bind(null, s.id)} className="mt-1 flex gap-1">
                          <input name="comment" required placeholder="Reason" className="w-28 rounded border border-nicta-neutral-200 px-1 py-0.5 text-xs" />
                          <button type="submit" className="text-xs text-status-danger">Send</button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 text-sm font-semibold text-nicta-teal-dark">Recently Confirmed</h2>
        {confirmed.length === 0 ? (
          <EmptyState title="No confirmed Board escalations yet." />
        ) : (
          <ul className="divide-y divide-nicta-neutral-200">
            {confirmed.map((s) => (
              <li key={s.id} className="px-5 py-3 text-sm">
                <span className="font-semibold text-nicta-teal-dark">{s.referenceNumber}</span> — {s.title}{' '}
                <span className="text-xs text-nicta-neutral-700">({s.department.name})</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PortalShell>
  );
}
