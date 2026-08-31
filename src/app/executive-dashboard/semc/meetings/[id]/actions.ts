'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { publishSemcMeeting, transitionSemcMeetingStatus, type SemcMeetingState } from '@/lib/semc/meetings';
import { recordSemcOutcome, addChairpersonComment, type SemcOutcome } from '@/lib/semc/outcomes';
import { uploadSemcMinutes, submitSemcMinutesForCeoReview, confirmSemcMinutes, returnSemcMinutesForCorrection } from '@/lib/semc/minutes';

function revalidateAndReturn(meetingId: string) {
  revalidatePath(`/executive-dashboard/semc/meetings/${meetingId}`);
  redirect(`/executive-dashboard/semc/meetings/${meetingId}`);
}

export async function publishSemcMeetingAction(meetingId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await publishSemcMeeting(meetingId, user);
  revalidateAndReturn(meetingId);
}

export async function transitionSemcMeetingAction(meetingId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await transitionSemcMeetingStatus(meetingId, String(formData.get('toState')) as SemcMeetingState, user);
  revalidateAndReturn(meetingId);
}

export async function recordSemcOutcomeAction(meetingId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await recordSemcOutcome(
    {
      submissionId: String(formData.get('submissionId') ?? ''),
      meetingId,
      agendaItemId: String(formData.get('agendaItemId') ?? '') || undefined,
      outcome: String(formData.get('outcome')) as SemcOutcome,
      decisionWording: String(formData.get('decisionWording') ?? ''),
      semcComments: String(formData.get('semcComments') ?? '') || undefined,
      responsiblePersonId: String(formData.get('responsiblePersonId') ?? '') || undefined,
      dueDate: formData.get('dueDate') ? new Date(String(formData.get('dueDate'))) : undefined,
    },
    user,
  );
  revalidateAndReturn(meetingId);
}

export async function addChairpersonCommentAction(meetingId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await addChairpersonComment(String(formData.get('submissionId') ?? ''), user, String(formData.get('body') ?? ''));
  revalidateAndReturn(meetingId);
}

export async function uploadSemcMinutesAction(meetingId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) throw new Error('Select a file to upload.');
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadSemcMinutes(meetingId, { buffer, fileName: file.name, contentType: file.type || 'application/octet-stream' }, user);
  revalidateAndReturn(meetingId);
}

export async function submitSemcMinutesForCeoReviewAction(meetingId: string, minutesId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await submitSemcMinutesForCeoReview(minutesId, user);
  revalidateAndReturn(meetingId);
}

export async function confirmSemcMinutesAction(meetingId: string, minutesId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await confirmSemcMinutes(minutesId, user);
  revalidateAndReturn(meetingId);
}

export async function returnSemcMinutesAction(meetingId: string, minutesId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await returnSemcMinutesForCorrection(minutesId, user, String(formData.get('comment') ?? ''));
  revalidateAndReturn(meetingId);
}
