import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedUser } from '@/lib/auth/types';

// Shared by both providers: given a user id trusted only as "which row to look up", build the
// full AuthenticatedUser from the current database state. This is the single place role and
// department data enter the session-derived object.
export async function loadAuthenticatedUser(userId: string): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      department: true,
      roles: { include: { role: true, department: true } },
    },
  });

  if (!user || !user.isActive) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    departmentId: user.departmentId,
    departmentCode: user.department?.code ?? null,
    isDemoUser: user.isDemoUser,
    roles: user.roles.map((ur) => ({
      roleCode: ur.role.code as AuthenticatedUser['roles'][number]['roleCode'],
      roleName: ur.role.name,
      departmentId: ur.departmentId,
    })),
  };
}
