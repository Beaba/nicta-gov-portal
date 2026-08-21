import { getSession } from '@/lib/auth/session';
import { loadAuthenticatedUser } from '@/lib/auth/loadUser';
import { prisma } from '@/lib/db/prisma';
import { createMsalClient, ENTRA_LOGIN_SCOPES } from '@/lib/auth/msalClient';
import { getEnv } from '@/lib/config/env';
import type { AuthProvider, AuthenticatedUser } from '@/lib/auth/types';

// Production provider. Requires an Entra ID app registration (docs/entra-id-registration-guide.md).
// Login/callback routes live at src/app/api/auth/entra/{login,callback}/route.ts; this class only
// holds the parts shared with the rest of the app (current-user resolution and sign-out).
export class EntraAuthProvider implements AuthProvider {
  readonly providerName = 'entra' as const;

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

/** `state` is a per-login-attempt random value the caller generates and stashes in the session
 * (see /api/auth/entra/login) — round-tripped through Microsoft and checked back in
 * completeEntraSignIn's caller so a forged callback can't be used to bind an attacker-chosen
 * account into a victim's browser session (OAuth CSRF). */
export async function buildEntraAuthCodeUrl(state: string): Promise<string> {
  const env = getEnv();
  const client = createMsalClient();
  return client.getAuthCodeUrl({
    scopes: ENTRA_LOGIN_SCOPES,
    redirectUri: env.AZURE_AD_REDIRECT_URI ?? `${env.APP_BASE_URL}/api/auth/entra/callback`,
    state,
  });
}

/**
 * Exchanges the authorization code for tokens, provisions/updates the local User row by Entra
 * object id (never trusting client-supplied role claims — role/department come only from this
 * application's own UserRole table), and starts the local session.
 *
 * A user must already exist in the portal's Department/Role reference data via the
 * Administration screens before their first Entra sign-in resolves to an authorized account;
 * this deliberately does not auto-provision access.
 */
export async function completeEntraSignIn(code: string): Promise<AuthenticatedUser | null> {
  const env = getEnv();
  const client = createMsalClient();
  const result = await client.acquireTokenByCode({
    code,
    scopes: ENTRA_LOGIN_SCOPES,
    redirectUri: env.AZURE_AD_REDIRECT_URI ?? `${env.APP_BASE_URL}/api/auth/entra/callback`,
  });

  if (!result?.account) return null;

  const entraObjectId = result.account.homeAccountId;
  const email = result.account.username;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ entraObjectId }, { email }] },
  });

  if (!existing) {
    // No matching provisioned account — reject rather than silently granting access.
    return null;
  }

  if (!existing.entraObjectId) {
    await prisma.user.update({ where: { id: existing.id }, data: { entraObjectId } });
  }

  const session = await getSession();
  session.userId = existing.id;
  session.entraAccountHomeId = entraObjectId;
  await session.save();

  return loadAuthenticatedUser(existing.id);
}
