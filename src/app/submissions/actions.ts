'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { createAndSubmitPaper } from '@/lib/submissions/submissions';

export interface CreateSubmissionResult {
  error?: string;
  submissionId?: string;
}

// Called directly from the client-side modal (src/components/NewSubmissionModal.tsx) rather than
// bound to a <form action>, since this React 18 build has no useFormState/useActionState to carry
// the result back — the modal awaits this and shows the error inline without a full navigation,
// matching the reference design's single-dialog "Submit to SMC" flow.
export async function createAndSubmitPaperAction(
  formData: FormData,
): Promise<CreateSubmissionResult> {
  const user = requireUser(await getCurrentUser());
  if (!user.departmentId) {
    return { error: 'Your account has no department assigned — contact an administrator.' };
  }

  const title = String(formData.get('title') ?? '').trim();
  const templateId = String(formData.get('templateId') ?? '');
  const purpose = String(formData.get('purpose') ?? '').trim();
  const lateJustification = String(formData.get('lateJustification') ?? '').trim() || undefined;
  const file = formData.get('file');
  const annexureFiles = formData
    .getAll('annexures')
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!title) return { error: 'Enter a paper title.' };
  if (!templateId) return { error: 'Select an approved template.' };
  if (!purpose) return { error: 'Enter a paper description.' };
  if (!(file instanceof File) || file.size === 0) return { error: 'Select a file to upload.' };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const annexures = await Promise.all(
      annexureFiles.map(async (f) => ({
        buffer: Buffer.from(await f.arrayBuffer()),
        fileName: f.name,
        contentType: f.type,
        title: f.name,
      })),
    );
    const { submission } = await createAndSubmitPaper(
      { title, templateId, departmentId: user.departmentId, purpose },
      { buffer, fileName: file.name, contentType: file.type },
      user,
      annexures,
      lateJustification,
    );
    revalidatePath('/submissions');
    return { submissionId: submission.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Submission failed.' };
  }
}
