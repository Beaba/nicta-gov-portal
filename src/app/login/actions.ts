'use server';

import { redirect } from 'next/navigation';
import { mockSignIn } from '@/lib/auth/mockProvider';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import { ROLE_LANDING_PAGE, ROLE_LANDING_PRIORITY } from '@/lib/config/roles';
import { prisma } from '@/lib/db/prisma';

// Mock-mode email sign-in: matches production Entra's own rule (docs/assumptions-and-decisions.md#A3)
// that an account must already be provisioned by an Admin before anyone can sign in with it — the
// email is what's checked here, the same way it's what Entra checks on a real callback. There is no
// local password store in this app (see CLAUDE.md's provider-interface convention: only the `mock`
// demo flow and real Entra ID exist), so the password field is not cryptographically verified; it
// exists so the mock flow's UX matches the real one, not to gate access on its own.
export async function signInWithEmail(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) {
    redirect('/login?error=missing_credentials');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    redirect('/login?error=not_provisioned');
  }

  await mockSignIn(user.id);
  const authUser = await loadAuthenticatedUser(user.id);
  const primaryRole = authUser
    ? ROLE_LANDING_PRIORITY.find((role) => authUser.roles.some((r) => r.roleCode === role))
    : undefined;
  redirect(primaryRole ? ROLE_LANDING_PAGE[primaryRole] : '/login');
}
