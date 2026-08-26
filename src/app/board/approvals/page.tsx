import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listMyBoardApprovals } from '@/lib/board/decisions';
import { PortalShell } from '@/components/PortalShell';

export default async function BoardApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'BOARD_MEMBER' || r.roleCode === 'SYSTEM_ADMIN')) {
    redirect('/board/dashboard');
  }

  const items = await listMyBoardApprovals(user);

  return (
    <PortalShell user={user} active="board-approvals">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Approval Inbox</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Decision Papers currently awaiting your vote.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        {items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-nicta-neutral-700">
            Nothing is currently awaiting your decision.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Reference</th>
                <th className="px-5 py-2 font-semibold">Title</th>
                <th className="px-5 py-2 font-semibold">Department</th>
                <th className="px-5 py-2 font-semibold">Meeting</th>
                <th className="px-5 py-2 font-semibold">Confidentiality</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal">{p.referenceNumber}</td>
                  <td className="px-5 py-3 text-nicta-neutral-900">{p.title}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{p.department.name}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{p.meeting?.title ?? '—'}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{p.confidentiality}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/submissions/${p.id}`}
                      className="text-sm font-semibold text-nicta-teal hover:underline"
                    >
                      Review &amp; Decide
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
