'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import {
  publishBoardMeeting,
  transitionBoardMeetingStatus,
  addAgendaItem,
  removeAgendaItem,
  recordAttendance,
  listActiveBoardMembers,
  type BoardMeetingState,
} from '@/lib/board/meetings';
import { uploadMinutes, submitMinutesForReview, publishMinutes } from '@/lib/board/minutes';
import {
  createResolution,
  transitionResolutionStatus,
  type ResolutionStatus,
} from '@/lib/board/resolutions';
import { createBoardActionItem } from '@/lib/board/actionItems';

function revalidateMeeting(meetingId: string) {
  revalidatePath(`/board/meetings/${meetingId}`);
  revalidatePath('/board/meetings');
  revalidatePath('/board/dashboard');
}

export async function publishMeetingAction(meetingId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await publishBoardMeeting(meetingId, user);
  revalidateMeeting(meetingId);
}

export async function transitionMeetingStatusAction(
  meetingId: string,
  toState: BoardMeetingState,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await transitionBoardMeetingStatus(meetingId, toState, user);
  revalidateMeeting(meetingId);
}

export async function addAgendaItemAction(meetingId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const title = String(formData.get('title') ?? '');
  const description = String(formData.get('description') ?? '') || undefined;
  const submissionId = String(formData.get('submissionId') ?? '') || undefined;
  await addAgendaItem(meetingId, { title, description, submissionId }, user);
  revalidateMeeting(meetingId);
}

export async function removeAgendaItemAction(
  meetingId: string,
  agendaItemId: string,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await removeAgendaItem(agendaItemId, user);
  revalidateMeeting(meetingId);
}

export async function recordAttendanceAction(meetingId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const members = await listActiveBoardMembers();
  const records = members.map((m) => ({
    userId: m.id,
    status: String(formData.get(`status_${m.id}`) ?? 'ABSENT') as 'ATTENDED' | 'APOLOGY' | 'ABSENT',
  }));
  await recordAttendance(meetingId, records, user);
  revalidateMeeting(meetingId);
}

export async function uploadMinutesAction(meetingId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return;
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadMinutes(meetingId, { buffer, fileName: file.name, contentType: file.type }, user);
  revalidateMeeting(meetingId);
}

export async function submitMinutesForReviewAction(
  meetingId: string,
  minutesId: string,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await submitMinutesForReview(minutesId, user);
  revalidateMeeting(meetingId);
}

export async function publishMinutesAction(meetingId: string, minutesId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await publishMinutes(minutesId, user);
  revalidateMeeting(meetingId);
}

export async function createResolutionAction(meetingId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const agendaItemId = String(formData.get('agendaItemId') ?? '') || undefined;
  const subject = String(formData.get('subject') ?? '');
  const resolutionText = String(formData.get('resolutionText') ?? '');
  const responsiblePersonId = String(formData.get('responsiblePersonId') ?? '') || undefined;
  const responsibleDepartmentId =
    String(formData.get('responsibleDepartmentId') ?? '') || undefined;
  const dueDateRaw = String(formData.get('dueDate') ?? '');

  await createResolution(
    {
      meetingId,
      agendaItemId,
      subject,
      resolutionText,
      responsiblePersonId,
      responsibleDepartmentId,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
    },
    user,
  );
  revalidateMeeting(meetingId);
}

export async function transitionResolutionStatusAction(
  meetingId: string,
  resolutionId: string,
  toStatus: ResolutionStatus,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const followUpNotes = String(formData.get('followUpNotes') ?? '') || undefined;
  await transitionResolutionStatus(resolutionId, toStatus, user, followUpNotes);
  revalidateMeeting(meetingId);
}

export async function createBoardActionItemAction(
  meetingId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const description = String(formData.get('description') ?? '');
  const ownerId = String(formData.get('ownerId') ?? '') || undefined;
  const departmentId = String(formData.get('departmentId') ?? '') || undefined;
  const resolutionId = String(formData.get('resolutionId') ?? '') || undefined;
  const dueDateRaw = String(formData.get('dueDate') ?? '');

  await createBoardActionItem(
    {
      description,
      ownerId,
      departmentId,
      resolutionId,
      sourceMeetingId: meetingId,
      dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined,
    },
    user,
  );
  revalidateMeeting(meetingId);
}
