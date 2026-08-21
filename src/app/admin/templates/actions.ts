'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireAnyRole } from '@/lib/auth/rbac';
import { uploadTemplateVersion } from '@/lib/templates/templates';

export async function uploadTemplateVersionAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  requireAnyRole(user, ['SYSTEM_ADMIN', 'REVIEWER_SECRETARIAT']);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0)
    throw new Error('Select a template file to upload.');

  const paperType = String(formData.get('paperType') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  if (!paperType || !name) throw new Error('Name and paper type are required.');

  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadTemplateVersion({
    code: `${paperType.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_${Date.now()}`,
    name,
    category: 'SMCPaper',
    paperType,
    buffer,
    fileName: file.name,
    contentType: file.type,
    uploadedById: user.id,
  });

  revalidatePath('/admin/templates');
}
