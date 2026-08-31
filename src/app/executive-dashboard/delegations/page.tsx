import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { listDelegationsForCeo } from '@/lib/delegations/delegations';
import { isOverdue } from '@/lib/delegations/workflow';
import { listAppointmentsForUser } from '@/lib/appointments/appointments';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { DelegationStatusBadge } from '@/components/DelegationStatusBadge';
import { NewDelegationModal } from '@/components/NewDelegationModal';
import { EmptyState } from '@/components/EmptyState';
import { PeopleIcon, ClockIcon, AlertTriangleIcon, CalendarIcon, ChartIcon } from '@/components/icons';

// #A32 — Screen 4, "CEO Delegations & Appointments": the combined view the mockup shows as one
// screen. Reuses the existing, already-tested Delegation feature (#A29, listDelegationsForCeo,
// NewDelegationModal) and the new Appointments feature side by side, rather than building a
// third, separate model for either — matching the client's own "do not create duplicate
// models/services" instruction. `/delegations` (the original #A29 register) is unchanged and still
// reachable directly; this page supersedes it only as the CEO nav's own destination.
export default async function ExecutiveDelegationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN')) redirect('/');

  const [delegations, directors, managers, departments, appointments] = await Promise.all([
    listDelegationsForCeo(user),
    prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'SUBMITTER' } } } }, include: { department: true }, orderBy: { name: 'asc' } }),
    prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'MANAGER' } } } }, include: { department: true }, orderBy: { name: 'asc' } }),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    listAppointmentsForUser(user),
  ]);

  const now = Date.now();
  const weekAhead = now + 7 * 24 * 60 * 60 * 1000;
  const activeCount = delegations.filter((d) => !['CLOSED', 'CANCELLED'].includes(d.status)).length;
  const awaitingAcceptanceCount = delegations.filter((d) => d.status === 'ISSUED').length;
  const dueThisWeekCount = delegations.filter((d) => d.dueDate.getTime() <= weekAhead && d.dueDate.getTime() >= now).length;
  const overdueCount = delegations.filter((d) => isOverdue(d)).length;
  const upcomingAppointments = appointments.filter((a) => a.startAt.getTime() >= now && a.status !== 'CANCELLED');
  const respondedCount = appointments.reduce((sum, a) => sum + a.invitees.filter((i) => i.response !== 'PENDING').length, 0);

  return (
    <PortalShell user={user} active="delegations" variant="executive">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight text-nicta-teal-dark">CEO Delegations &amp; Appointments</h1>
          <p className="mt-1 text-xs font-medium text-nicta-teal">
            Portal <span className="px-2 text-nicta-neutral-700">/</span> CEO <span className="px-2 text-nicta-neutral-700">/</span> Executive Management
          </p>
        </div>
        <div className="flex gap-2">
          <NewDelegationModal
            directors={directors.map((d) => ({ id: d.id, name: d.name, departmentName: d.department?.name ?? null }))}
            departments={departments}
            managers={managers.map((m) => ({ id: m.id, name: m.name, departmentName: m.department?.name ?? null }))}
          />
          <a
            href="/executive-dashboard/appointments"
            className="flex items-center gap-2 rounded-md border border-nicta-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-100"
          >
            Schedule Appointment
          </a>
        </div>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <DashboardStatCard label="Active Delegations" value={activeCount} icon={PeopleIcon} compact />
        <DashboardStatCard label="Awaiting Acceptance" value={awaitingAcceptanceCount} icon={ClockIcon} compact />
        <DashboardStatCard label="Due This Week" value={dueThisWeekCount} icon={CalendarIcon} compact />
        <DashboardStatCard label="Overdue" value={overdueCount} icon={AlertTriangleIcon} tone={overdueCount > 0 ? 'danger' : 'default'} compact />
        <DashboardStatCard label="Upcoming Appointments" value={upcomingAppointments.length} icon={CalendarIcon} compact />
        <DashboardStatCard label="Event Responses" value={respondedCount} icon={ChartIcon} compact />
      </div>

      <section className="mt-3 overflow-hidden rounded-lg border border-nicta-neutral-200 bg-white shadow-[0_2px_8px_rgba(21,60,68,0.04)]">
        <div className="border-b border-nicta-neutral-200 px-3.5 py-2.5">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">Delegations &amp; Tasks</h2>
        </div>
        <div className="p-3.5">
          {delegations.length === 0 ? (
            <EmptyState title="No delegations have been created yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-nicta-neutral-200 text-[10px] uppercase tracking-wide text-nicta-neutral-700">
                  <tr>
                    <th className="pb-2 font-semibold">Reference</th>
                    <th className="pb-2 font-semibold">Task</th>
                    <th className="pb-2 font-semibold">Accountable Lead</th>
                    <th className="pb-2 font-semibold">Category</th>
                    <th className="pb-2 font-semibold">Due</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nicta-neutral-200">
                  {delegations.map((d) => (
                    <tr key={d.id}>
                      <td className="whitespace-nowrap py-2 pr-3 font-semibold text-nicta-teal">{d.referenceNumber}</td>
                      <td className="max-w-[200px] truncate py-2 pr-3 text-nicta-neutral-900">{d.title}</td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">{d.responsibleDirector.name}</td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">{d.category ?? '—'}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-nicta-neutral-700">{d.dueDate.toLocaleDateString()}</td>
                      <td className="py-2 pr-3">
                        <DelegationStatusBadge delegation={d} />
                      </td>
                      <td className="py-2 text-right">
                        <a href={`/delegations/${d.id}`} className="inline-flex rounded border border-nicta-teal px-2.5 py-1 text-[10px] font-semibold text-nicta-teal hover:bg-nicta-teal hover:text-white">
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mt-3 overflow-hidden rounded-lg border border-nicta-neutral-200 bg-white shadow-[0_2px_8px_rgba(21,60,68,0.04)]">
        <div className="flex items-center justify-between border-b border-nicta-neutral-200 px-3.5 py-2.5">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">Appointments &amp; Invitations</h2>
          <a href="/executive-dashboard/appointments" className="text-xs font-semibold text-nicta-teal hover:underline">View all →</a>
        </div>
        <div className="p-3.5">
          {upcomingAppointments.length === 0 ? (
            <EmptyState title="No upcoming appointments." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="border-b border-nicta-neutral-200 text-[10px] uppercase tracking-wide text-nicta-neutral-700">
                  <tr>
                    <th className="pb-2 font-semibold">Date &amp; Time</th>
                    <th className="pb-2 font-semibold">Subject</th>
                    <th className="pb-2 font-semibold">Invitees</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-nicta-neutral-200">
                  {upcomingAppointments.slice(0, 8).map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap py-2 pr-3 text-nicta-neutral-700">{a.startAt.toLocaleString()}</td>
                      <td className="py-2 pr-3 font-medium text-nicta-neutral-900">{a.title}</td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">{a.invitees.map((i) => i.user.name).join(', ')}</td>
                      <td className="py-2 pr-3 text-nicta-neutral-700">{a.status}</td>
                      <td className="py-2 text-right">
                        <a href={`/executive-dashboard/appointments/${a.id}`} className="text-[10px] font-semibold text-nicta-teal hover:underline">
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </PortalShell>
  );
}
