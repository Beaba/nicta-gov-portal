'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import {
  acceptForSemcAgenda,
  returnSemcSubmissionToDirector,
  requestSemcMoreInformation,
  addSemcPreliminaryComment,
  rejectSemcSubmission,
  closeSemcSubmission,
  recommendBoardEscalation,
} from '@/lib/submissions/semcReview';

function bindAndReturn(id: string) {
  revalidatePath('/executive-dashboard/semc');
  redirect(`/executive-dashboard/semc?selected=${id}`);
}

export async function acceptForSemcAgendaAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await acceptForSemcAgenda(id, user, String(formData.get('comment') ?? '') || undefined);
  bindAndReturn(id);
}

export async function returnSemcSubmissionToDirectorAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await returnSemcSubmissionToDirector(id, user, String(formData.get('comment') ?? ''));
  bindAndReturn(id);
}

export async function requestSemcMoreInformationAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await requestSemcMoreInformation(id, user, String(formData.get('comment') ?? ''));
  bindAndReturn(id);
}

export async function addSemcPreliminaryCommentAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await addSemcPreliminaryComment(id, user, String(formData.get('comment') ?? ''));
  bindAndReturn(id);
}

export async function rejectSemcSubmissionAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await rejectSemcSubmission(id, user, String(formData.get('comment') ?? ''));
  bindAndReturn(id);
}

export async function closeSemcSubmissionAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await closeSemcSubmission(id, user, String(formData.get('comment') ?? '') || undefined);
  bindAndReturn(id);
}

export async function recommendBoardEscalationAction(id: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await recommendBoardEscalation(id, user, String(formData.get('reason') ?? ''));
  revalidatePath('/executive-dashboard/semc/escalations');
  redirect('/executive-dashboard/semc/escalations');
}
