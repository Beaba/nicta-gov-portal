import { getSession } from '@/lib/auth/session';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import type { AuthProvider, AuthenticatedUser } from '@/lib/auth/types';

// Demo-mode provider: a "sign in as <demo user>" picker with no password, intended only for
// local development and demonstration. The session cookie is still signed/encrypted
// (iron-session) so it cannot be forged client-side, but there is no real credential check —
// see docs/security-notes.md for why this must never be enabled in a production deployment.
export class MockAuthProvider implements AuthProvider {
  readonly providerName = 'mock' as const;

  async getCurrentUser(): Promise<AuthenticatedUser | null> {
    const session = await getSession();
    if (!session.userId) return null;
    return loadAuthenticatedUser(session.userId);
  }

  async signOut(): Promise<void> {
    const session = await getSession();
    session.destroy();
  }
}

export async function mockSignIn(userId: string): Promise<void> {
  const session = await getSession();
  session.userId = userId;
  await session.save();
}
