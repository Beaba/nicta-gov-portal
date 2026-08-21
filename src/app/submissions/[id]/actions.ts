'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import {
  uploadMainDocument,
  uploadAnnexure,
  submitSubmission,
} from '@/lib/submissions/submissions';
import { submitBoardPaper, addActionItem } from '@/lib/submissions/review';

function readFile(formData: FormData, key: string): File {
  const file = formData.get(key);
  if (!(file instanceof File) || file.size === 0) {
    throw new Error('Select a file to upload.');
  }
  return file;
}

export async function uploadMainDocumentAction(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const file = readFile(formData, 'file');
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadMainDocument(
    submissionId,
    { buffer, fileName: file.name, contentType: file.type },
    user,
  );
  revalidatePath(`/submissions/${submissionId}`);
}

export async function uploadAnnexureAction(
  submissionId: string,
  formData: FormData,
): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const file = readFile(formData, 'file');
  const title = String(formData.get('title') ?? file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadAnnexure(
    submissionId,
    { buffer, fileName: file.name, contentType: file.type, title },
    user,
  );
  revalidatePath(`/submissions/${submissionId}`);
}

export async function submitSubmissionAction(submissionId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await submitSubmission(submissionId, user);
  redirect(`/submissions/${submissionId}/ai-review`);
}

export interface SubmitBoardPaperResult {
  error?: string;
  boardPaperId?: string;
}

// Called directly from the client-side modal (BoardPaperModal), same pattern as
// createAndSubmitPaperAction — see that file's comment for why (no useFormState in this React 18
// build).
export async function submitBoardPaperAction(
  sourceSubmissionId: string,
  formData: FormData,
): Promise<SubmitBoardPaperResult> {
  const user = requireUser(await getCurrentUser());
  const boardSummary = String(formData.get('boardSummary') ?? '').trim();
  const file = formData.get('file');

  if (!boardSummary) return { error: 'Enter a Board summary based on SEMC’s comments.' };
  if (!(file instanceof File) || file.size === 0) return { error: 'Select a file to upload.' };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const boardPaper = await submitBoardPaper(
      sourceSubmissionId,
      { boardSummary, file: { buffer, fileName: file.name, contentType: file.type } },
      user,
    );
    revalidatePath(`/submissions/${sourceSubmissionId}`);
    revalidatePath('/board-papers');
    return { boardPaperId: boardPaper.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Board Paper submission failed.' };
  }
}

export async function addActionItemAction(submissionId: string, formData: FormData): Promise<void> {
  const user = requireUser(await getCurrentUser());
  const description = String(formData.get('description') ?? '').trim();
  const dueDateRaw = String(formData.get('dueDate') ?? '');
  await addActionItem(
    submissionId,
    { description, dueDate: dueDateRaw ? new Date(dueDateRaw) : undefined },
    user,
  );
  revalidatePath(`/submissions/${submissionId}`);
}
