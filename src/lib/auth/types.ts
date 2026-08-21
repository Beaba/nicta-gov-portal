import type { RoleCode } from '@/lib/config/roles';

export interface SessionRoleAssignment {
  roleCode: RoleCode;
  roleName: string;
  departmentId: string | null;
}

// The authoritative "who is this and what can they do" shape used everywhere in the app.
// Always constructed server-side from the database on each request — never trust a client-
// supplied role. See docs/assumptions-and-decisions.md#A3.
export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentCode: string | null;
  roles: SessionRoleAssignment[];
  isDemoUser: boolean;
}

export interface AuthProvider {
  /** Resolves the current request's user from the session, or null if unauthenticated. */
  getCurrentUser(): Promise<AuthenticatedUser | null>;
  /** Provider-specific sign-out (clears session / redirects to IdP logout as applicable). */
  signOut(): Promise<void>;
  /** Human-readable name of the active provider, surfaced in the UI so it's always obvious which mode is running. */
  readonly providerName: 'mock' | 'entra';
}
