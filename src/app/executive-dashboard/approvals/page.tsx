import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { listCeoApprovalInbox } from '@/lib/executive/approvalInbox';
import { PortalShell } from '@/components/PortalShell';

export default async function ExecutiveApprovalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER')) redirect('/');

  const items = await listCeoApprovalInbox(user);

  return (
    <PortalShell user={user} active="executive-approvals">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Approval Inbox</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Every SMC submission and Board Decision Paper currently awaiting a CEO decision, in one
        place. Each item links through to its real, working action panel.
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
                <th className="px-5 py-2 font-semibold">Type</th>
                <th className="px-5 py-2 font-semibold">From</th>
                <th className="px-5 py-2 font-semibold">Stage</th>
                <th className="px-5 py-2 font-semibold">Required Action</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal">
                    {item.referenceNumber}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-900">{item.title}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{item.documentType}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{item.originatingDepartment}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-status-warning-bg px-2.5 py-1 text-[11px] font-bold text-status-warning">
                      {item.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-nicta-neutral-700">
                    {item.requiredAction}
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={item.linkUrl}
                      className="text-sm font-semibold text-nicta-teal hover:underline"
                    >
                      Review
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
