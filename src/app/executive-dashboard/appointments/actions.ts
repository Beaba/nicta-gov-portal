'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import {
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  sendAppointmentReminder,
  recordAppointmentNotes,
  respondToAppointment,
  type InviteeResponse,
} from '@/lib/appointments/appointments';

export async function createAppointmentAction(formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await createAppointment(
    {
      title: String(formData.get('title') ?? ''),
      agenda: String(formData.get('agenda') ?? '') || undefined,
      startAt: new Date(String(formData.get('startAt'))),
      endAt: new Date(String(formData.get('endAt'))),
      location: String(formData.get('location') ?? '') || undefined,
      inviteeUserIds: formData.getAll('inviteeUserIds').map(String).filter(Boolean),
      createTeamsMeeting: formData.get('createTeamsMeeting') === 'on',
    },
    user,
  );
  revalidatePath('/executive-dashboard/appointments');
  redirect('/executive-dashboard/appointments');
}

export async function rescheduleAppointmentAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await rescheduleAppointment(id, user, new Date(String(formData.get('startAt'))), new Date(String(formData.get('endAt'))));
  revalidatePath('/executive-dashboard/appointments');
  redirect(`/executive-dashboard/appointments/${id}`);
}

export async function cancelAppointmentAction(id: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await cancelAppointment(id, user);
  revalidatePath('/executive-dashboard/appointments');
  redirect('/executive-dashboard/appointments');
}

export async function sendAppointmentReminderAction(id: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await sendAppointmentReminder(id, user);
  revalidatePath(`/executive-dashboard/appointments/${id}`);
}

export async function recordAppointmentNotesAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await recordAppointmentNotes(id, user, String(formData.get('meetingNotes') ?? ''));
  revalidatePath(`/executive-dashboard/appointments/${id}`);
  redirect(`/executive-dashboard/appointments/${id}`);
}

export async function respondToAppointmentAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await respondToAppointment(
    id,
    user,
    String(formData.get('response')) as InviteeResponse,
    String(formData.get('responseReason') ?? '') || undefined,
    String(formData.get('alternateUserId') ?? '') || undefined,
  );
  revalidatePath(`/executive-dashboard/appointments/${id}`);
  redirect(`/executive-dashboard/appointments/${id}`);
}
