import type { AuthenticatedUser } from '@/lib/auth/types';
import type { RoleCode } from '@/lib/config/roles';

export class AuthorizationError extends Error {
  constructor(message = 'Not authorized') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export function hasRole(user: AuthenticatedUser, role: RoleCode): boolean {
  return user.roles.some((r) => r.roleCode === role);
}

export function hasAnyRole(user: AuthenticatedUser, roles: readonly RoleCode[]): boolean {
  return user.roles.some((r) => roles.includes(r.roleCode));
}

/** Department ids the user holds `role` for. A role assignment with a null department is
 * organization-wide for that role (used for OCEO/Secretariat/Board/Executive/Admin roles). */
export function departmentScopeForRole(user: AuthenticatedUser, role: RoleCode): string[] | 'ALL' {
  const assignments = user.roles.filter((r) => r.roleCode === role);
  if (assignments.some((a) => a.departmentId === null)) return 'ALL';
  return assignments.map((a) => a.departmentId).filter((id): id is string => id !== null);
}

/**
 * Section 3: "Administrators must not automatically receive permission to read confidential
 * Board papers unless separately assigned an authorized governance role." SYSTEM_ADMIN is
 * therefore deliberately excluded from this list — it grants configuration access, not
 * governance-content access.
 */
const GOVERNANCE_CONTENT_ROLES: RoleCode[] = [
  'DIRECTOR',
  'SMC_SECRETARIAT',
  'SMC_MEMBER',
  'BOARD_SECRETARIAT',
  'EXECUTIVE_VIEWER',
];

export function canReadGovernanceContent(user: AuthenticatedUser): boolean {
  return hasAnyRole(user, GOVERNANCE_CONTENT_ROLES);
}

export function canAccessDepartment(user: AuthenticatedUser, departmentId: string): boolean {
  if (hasRole(user, 'EXECUTIVE_VIEWER')) return true;
  if (user.departmentId === departmentId) return true;
  return user.roles.some(
    (r) =>
      (r.roleCode === 'DIRECTOR' || r.roleCode === 'MANAGER') && r.departmentId === departmentId,
  );
}

export function requireUser<T extends AuthenticatedUser | null>(user: T): AuthenticatedUser {
  if (!user) throw new AuthorizationError('Sign in required');
  return user;
}

export function requireRole(user: AuthenticatedUser, role: RoleCode): void {
  if (!hasRole(user, role)) {
    throw new AuthorizationError(`Requires role ${role}`);
  }
}

export function requireAnyRole(user: AuthenticatedUser, roles: readonly RoleCode[]): void {
  if (!hasAnyRole(user, roles)) {
    throw new AuthorizationError(`Requires one of roles: ${roles.join(', ')}`);
  }
}

export function requireDepartmentAccess(user: AuthenticatedUser, departmentId: string): void {
  if (!canAccessDepartment(user, departmentId)) {
    throw new AuthorizationError('No access to this department');
  }
}
