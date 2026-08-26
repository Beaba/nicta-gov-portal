'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { createBoardMeeting } from '@/lib/board/meetings';

export interface CreateMeetingResult {
  error?: string;
  meetingId?: string;
}

export async function createBoardMeetingAction(formData: FormData): Promise<CreateMeetingResult> {
  const user = requireUser(await getCurrentUser());
  const title = String(formData.get('title') ?? '').trim();
  const meetingDateRaw = String(formData.get('meetingDate') ?? '');
  const venue = String(formData.get('venue') ?? '').trim() || undefined;

  if (!meetingDateRaw) return { error: 'Select a meeting date and time.' };

  try {
    const meeting = await createBoardMeeting(
      { title, meetingDate: new Date(meetingDateRaw), venue },
      user,
    );
    revalidatePath('/board/meetings');
    return { meetingId: meeting.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create the meeting.' };
  }
}
