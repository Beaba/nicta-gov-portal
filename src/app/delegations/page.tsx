import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { listDelegationsForCeo, listDelegationsForDirector } from '@/lib/delegations/delegations';
import { isOverdue } from '@/lib/delegations/workflow';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { DelegationStatusBadge } from '@/components/DelegationStatusBadge';
import { NewDelegationModal } from '@/components/NewDelegationModal';
import { PeopleIcon, ClockIcon, AlertTriangleIcon, ShieldCheckIcon } from '@/components/icons';

// CEO -> Director delegation register (#A29). CEO sees every delegation; a Director sees only
// their own — same least-privilege boundary as /submissions (a Director's own SMC papers only).
export default async function DelegationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const isCeo = user.roles.some(
    (r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN',
  );
  const isDirector = user.roles.some((r) => r.roleCode === 'SUBMITTER');
  if (!isCeo && !isDirector) redirect('/');

  const [delegations, directors, departments] = await Promise.all([
    isCeo ? listDelegationsForCeo(user) : listDelegationsForDirector(user),
    isCeo
      ? prisma.user.findMany({
          where: { isActive: true, roles: { some: { role: { code: 'SUBMITTER' } } } },
          include: { department: true },
          orderBy: { name: 'asc' },
        })
      : Promise.resolve([]),
    isCeo
      ? prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
      : Promise.resolve([]),
  ]);

  const activeCount = delegations.filter((d) => !['CLOSED', 'CANCELLED'].includes(d.status)).length;
  const atRiskCount = delegations.filter((d) => d.status === 'AT_RISK').length;
  const overdueCount = delegations.filter((d) => isOverdue(d)).length;
  const completedCount = delegations.filter((d) =>
    ['COMPLETED', 'CLOSED'].includes(d.status),
  ).length;

  return (
    <PortalShell user={user} active="delegations">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nicta-teal-dark">
            {isCeo ? 'CEO Delegations' : 'Executive Delegations'}
          </h1>
          <p className="mt-1 text-sm text-nicta-neutral-700">
            {isCeo
              ? 'Delegations issued to Directors — track responses and close out completed work.'
              : 'Delegations issued to you by the CEO.'}
          </p>
          <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />
        </div>
        {isCeo && (
          <NewDelegationModal
            directors={directors.map(toDirectorOption)}
            departments={departments}
          />
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard label="Active" value={activeCount} icon={PeopleIcon} />
        <DashboardStatCard label="At Risk" value={atRiskCount} icon={AlertTriangleIcon} />
        <DashboardStatCard label="Overdue" value={overdueCount} icon={ClockIcon} />
        <DashboardStatCard label="Completed" value={completedCount} icon={ShieldCheckIcon} />
      </div>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">
          {isCeo ? 'All Delegations' : 'My Delegations'}
        </h2>

        {delegations.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-nicta-neutral-700">
            {isCeo ? 'No delegations have been created yet.' : 'You have no delegations yet.'}
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Reference</th>
                <th className="px-5 py-2 font-semibold">Title</th>
                {isCeo && <th className="px-5 py-2 font-semibold">Director</th>}
                <th className="px-5 py-2 font-semibold">Priority</th>
                <th className="px-5 py-2 font-semibold">Due</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {delegations.map((d) => (
                <tr key={d.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal">{d.referenceNumber}</td>
                  <td className="px-5 py-3 text-nicta-neutral-900">{d.title}</td>
                  {isCeo && (
                    <td className="px-5 py-3 text-nicta-neutral-700">
                      {d.responsibleDirector.name}
                    </td>
                  )}
                  <td className="px-5 py-3 text-nicta-neutral-700">{formatPriority(d.priority)}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {d.dueDate.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <DelegationStatusBadge delegation={d} />
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/delegations/${d.id}`}
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

function formatPriority(priority: string): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function toDirectorOption(u: { id: string; name: string; department: { name: string } | null }) {
  return { id: u.id, name: u.name, departmentName: u.department?.name ?? null };
}
