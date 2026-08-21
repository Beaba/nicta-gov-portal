'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { requireAnyRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/db/prisma';
import { recordAuditEvent } from '@/lib/audit/auditLog';

// Same admin gate as src/app/admin/actions.ts — Corporate Secretary is the Admin, see
// docs/assumptions-and-decisions.md#A18. Duplicated locally because that helper is file-local
// and not exported.
async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');
  requireAnyRole(user, ['SYSTEM_ADMIN', 'REVIEWER_SECRETARIAT']);
  return user;
}

/**
 * Provisioning a real account is a deliberate admin act: Entra sign-in never auto-creates users
 * (docs/assumptions-and-decisions.md#A3), so this is the only way a real person gets access.
 * `entraObjectId` is intentionally left null — completeEntraSignIn() matches on email at first
 * sign-in and backfills it then.
 */
export async function addUserAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  const jobTitle = String(formData.get('jobTitle') ?? '').trim();
  const departmentId = String(formData.get('departmentId') ?? '').trim();
  const roleId = String(formData.get('roleId') ?? '').trim();

  if (!email || !name || !roleId) throw new Error('Email, name and role are required.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error(`A user with the email ${email} already exists.`);

  const created = await prisma.user.create({
    data: {
      email,
      name,
      jobTitle: jobTitle || null,
      departmentId: departmentId || null,
      isDemoUser: false,
      isActive: true,
    },
  });

  await prisma.userRole.create({
    data: { userId: created.id, roleId, departmentId: departmentId || null },
  });

  await recordAuditEvent({
    userId: admin.id,
    action: 'USER_PROVISIONED',
    entityType: 'User',
    entityId: created.id,
    newState: {
      email,
      name,
      jobTitle: jobTitle || null,
      departmentId: departmentId || null,
      roleId,
    },
  });

  revalidatePath('/admin/users');
}
