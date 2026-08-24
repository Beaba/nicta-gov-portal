'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireUser } from '@/lib/auth/rbac';
import { createDelegation, issueDelegation } from '@/lib/delegations/delegations';
import type { DelegationPriority, ConfidentialityLevel } from '@prisma/client';

export interface CreateDelegationResult {
  error?: string;
  delegationId?: string;
}

// Mirrors submissions/actions.ts's createAndSubmitPaperAction — called directly from the client
// modal (not bound to <form action>) so the modal can show a validation error inline without a
// full navigation.
export async function createDelegationAction(formData: FormData): Promise<CreateDelegationResult> {
  const user = requireUser(await getCurrentUser());

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const responsibleDirectorId = String(formData.get('responsibleDirectorId') ?? '');
  const supportingDepartmentId = String(formData.get('supportingDepartmentId') ?? '') || undefined;
  const supportingManagerId = String(formData.get('supportingManagerId') ?? '') || undefined;
  const priority = (String(formData.get('priority') ?? 'MEDIUM') || 'MEDIUM') as DelegationPriority;
  const startDateRaw = String(formData.get('startDate') ?? '');
  const dueDateRaw = String(formData.get('dueDate') ?? '');
  const expectedOutcome = String(formData.get('expectedOutcome') ?? '').trim();
  const requiredEvidence = String(formData.get('requiredEvidence') ?? '').trim() || undefined;
  const confidentiality = (String(formData.get('confidentiality') ?? 'INTERNAL') ||
    'INTERNAL') as ConfidentialityLevel;

  if (!responsibleDirectorId) return { error: 'Select the responsible Director.' };
  if (!startDateRaw || !dueDateRaw) return { error: 'Enter a start date and a due date.' };

  try {
    const delegation = await createDelegation(
      {
        title,
        description,
        responsibleDirectorId,
        supportingDepartmentId,
        supportingManagerId,
        priority,
        startDate: new Date(startDateRaw),
        dueDate: new Date(dueDateRaw),
        expectedOutcome,
        requiredEvidence,
        confidentiality,
      },
      user,
    );
    revalidatePath('/delegations');
    return { delegationId: delegation.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not create the delegation.' };
  }
}

export async function issueDelegationAction(delegationId: string): Promise<void> {
  const user = requireUser(await getCurrentUser());
  await issueDelegation(delegationId, user);
  revalidatePath('/delegations');
  revalidatePath(`/delegations/${delegationId}`);
  redirect(`/delegations/${delegationId}`);
}
