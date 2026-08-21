import { getEnv } from '@/lib/config/env';
import { MockAuthProvider } from '@/lib/auth/mockProvider';
import { EntraAuthProvider } from '@/lib/auth/entraProvider';
import type { AuthProvider, AuthenticatedUser } from '@/lib/auth/types';

// The one place a concrete provider is chosen. Everything else in the app imports
// getCurrentUser()/getAuthProvider() from here, never a concrete provider class.
let provider: AuthProvider | undefined;

export function getAuthProvider(): AuthProvider {
  if (provider) return provider;
  const env = getEnv();
  provider = env.AUTH_PROVIDER === 'entra' ? new EntraAuthProvider() : new MockAuthProvider();
  return provider;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  return getAuthProvider().getCurrentUser();
}

export type { AuthenticatedUser, SessionRoleAssignment, AuthProvider } from '@/lib/auth/types';
