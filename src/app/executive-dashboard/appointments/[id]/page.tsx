import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getAppointmentForUser } from '@/lib/appointments/appointments';
import { PortalShell } from '@/components/PortalShell';
import {
  rescheduleAppointmentAction,
  cancelAppointmentAction,
  sendAppointmentReminderAction,
  recordAppointmentNotesAction,
  respondToAppointmentAction,
} from '@/app/executive-dashboard/appointments/actions';

export default async function AppointmentDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const appointment = await getAppointmentForUser(params.id, user);
  if (!appointment) notFound();

  const isOrganiser = appointment.organiserId === user.id || user.roles.some((r) => r.roleCode === 'SYSTEM_ADMIN');
  const myInvite = appointment.invitees.find((i) => i.userId === user.id);

  return (
    <PortalShell user={user} active="executive-appointments">
      <h1 className="text-2xl font-semibold text-nicta-teal-dark">{appointment.title}</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        {appointment.startAt.toLocaleString()} – {appointment.endAt.toLocaleString()} · {appointment.status}
      </p>
      {appointment.location && <p className="text-sm text-nicta-neutral-700">{appointment.location}</p>}
      {appointment.teamsMeetingUrl ? (
        <a href={appointment.teamsMeetingUrl} className="mt-1 inline-block text-sm text-nicta-teal hover:underline">
          Join Teams meeting
        </a>
      ) : (
        <p className="mt-1 text-xs text-nicta-neutral-700">No live Teams link (Outlook/Teams not configured).</p>
      )}
      {appointment.agenda && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">Agenda</h2>
          <p className="mt-1 text-sm text-nicta-neutral-700">{appointment.agenda}</p>
        </div>
      )}

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-nicta-teal-dark">Invitees</h2>
        <ul className="mt-2 divide-y divide-nicta-neutral-200 rounded-lg border border-nicta-neutral-200 bg-white">
          {appointment.invitees.map((inv) => (
            <li key={inv.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span>{inv.user.name}</span>
              <span className="text-xs text-nicta-neutral-700">{inv.response.replace(/_/g, ' ')}</span>
            </li>
          ))}
        </ul>
      </div>

      {myInvite && myInvite.response === 'PENDING' && (
        <section className="mt-6 rounded-lg border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">Your response</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            <form action={respondToAppointmentAction.bind(null, appointment.id)}>
              <input type="hidden" name="response" value="ACCEPTED" />
              <button type="submit" className="rounded bg-status-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                Accept
              </button>
            </form>
            <details>
              <summary className="cursor-pointer rounded border border-status-danger px-3 py-1.5 text-xs font-semibold text-status-danger">
                Decline
              </summary>
              <form action={respondToAppointmentAction.bind(null, appointment.id)} className="mt-2 flex gap-2">
                <input type="hidden" name="response" value="DECLINED" />
                <input name="responseReason" required placeholder="Reason" className="input text-xs" />
                <button type="submit" className="rounded bg-status-danger px-2 py-1 text-xs font-semibold text-white">Send</button>
              </form>
            </details>
            <details>
              <summary className="cursor-pointer rounded border border-nicta-neutral-200 px-3 py-1.5 text-xs font-semibold text-nicta-teal-dark">
                Request Clarification
              </summary>
              <form action={respondToAppointmentAction.bind(null, appointment.id)} className="mt-2 flex gap-2">
                <input type="hidden" name="response" value="CLARIFICATION_REQUESTED" />
                <input name="responseReason" required placeholder="What needs clarifying?" className="input text-xs" />
                <button type="submit" className="rounded bg-nicta-teal-dark px-2 py-1 text-xs font-semibold text-white">Send</button>
              </form>
            </details>
          </div>
        </section>
      )}

      {isOrganiser && (
        <section className="mt-6 space-y-3 rounded-lg border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">Organiser controls</h2>
          <div className="flex flex-wrap gap-2">
            <form action={sendAppointmentReminderAction.bind(null, appointment.id)}>
              <button type="submit" className="rounded border border-nicta-neutral-200 px-3 py-1.5 text-xs font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-100">
                Send Reminder
              </button>
            </form>
            <form action={cancelAppointmentAction.bind(null, appointment.id)}>
              <button type="submit" className="rounded border border-status-danger px-3 py-1.5 text-xs font-semibold text-status-danger hover:bg-status-danger hover:text-white">
                Cancel Appointment
              </button>
            </form>
          </div>
          <form action={rescheduleAppointmentAction.bind(null, appointment.id)} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-xs text-nicta-neutral-700">New start</label>
              <input type="datetime-local" name="startAt" required className="input text-xs" />
            </div>
            <div>
              <label className="text-xs text-nicta-neutral-700">New end</label>
              <input type="datetime-local" name="endAt" required className="input text-xs" />
            </div>
            <button type="submit" className="rounded bg-nicta-teal-dark px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              Reschedule
            </button>
          </form>
          <form action={recordAppointmentNotesAction.bind(null, appointment.id)} className="space-y-1">
            <label className="text-xs text-nicta-neutral-700">Meeting notes</label>
            <textarea name="meetingNotes" rows={3} defaultValue={appointment.meetingNotes ?? ''} className="input text-xs" />
            <button type="submit" className="rounded bg-nicta-teal-dark px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              Save Notes
            </button>
          </form>
        </section>
      )}
    </PortalShell>
  );
}
