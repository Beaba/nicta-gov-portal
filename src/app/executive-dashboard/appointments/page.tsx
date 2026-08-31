import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { listAppointmentsForUser } from '@/lib/appointments/appointments';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';
import { createAppointmentAction } from '@/app/executive-dashboard/appointments/actions';

export default async function AppointmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const canOrganise = user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'CEO_OFFICE' || r.roleCode === 'SYSTEM_ADMIN');

  const [appointments, directors] = await Promise.all([
    listAppointmentsForUser(user),
    prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'SUBMITTER' } } } }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <PortalShell user={user} active="executive-appointments">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nicta-teal-dark">Appointments &amp; Invitations</h1>
          <p className="mt-1 text-sm text-nicta-neutral-700">
            Schedule appointments, invite Directors, and track responses.
          </p>
          <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />
        </div>
      </div>

      {canOrganise && (
        <details className="mt-4">
          <summary className="cursor-pointer list-none rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90 inline-block">
            + Schedule Appointment
          </summary>
          <form action={createAppointmentAction} className="mt-3 max-w-xl space-y-3 rounded-lg border border-nicta-neutral-200 bg-white p-4">
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Title</label>
              <input name="title" required className="input mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Agenda</label>
              <textarea name="agenda" rows={2} className="input mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-nicta-teal-dark">Start</label>
                <input type="datetime-local" name="startAt" required className="input mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-nicta-teal-dark">End</label>
                <input type="datetime-local" name="endAt" required className="input mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Location</label>
              <input name="location" className="input mt-1" placeholder="Boardroom A, or leave blank for Teams" />
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Invite Directors</label>
              <select name="inviteeUserIds" multiple className="input mt-1 h-24">
                {directors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-nicta-neutral-700">
              <input type="checkbox" name="createTeamsMeeting" />
              Create a Teams meeting (requires live Outlook/Teams credentials — falls back to no
              link if unavailable)
            </label>
            <button type="submit" className="w-full rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Schedule
            </button>
          </form>
        </details>
      )}

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        {appointments.length === 0 ? (
          <EmptyState title="No appointments scheduled yet." />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Date &amp; Time</th>
                <th className="px-5 py-2 font-semibold">Title</th>
                <th className="px-5 py-2 font-semibold">Invitees</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map((a) => (
                <tr key={a.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 text-nicta-neutral-700">{a.startAt.toLocaleString()}</td>
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{a.title}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{a.invitees.length}</td>
                  <td className="px-5 py-3 text-xs text-nicta-neutral-700">{a.status}</td>
                  <td className="px-5 py-3">
                    <a href={`/executive-dashboard/appointments/${a.id}`} className="text-sm font-semibold text-nicta-teal hover:underline">
                      Open
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
