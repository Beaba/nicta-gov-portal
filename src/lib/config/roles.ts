// Seed values only, mirroring SEED_DEPARTMENTS — see docs/assumptions-and-decisions.md#A4.
// Application authorization logic (src/lib/auth/rbac.ts) refers to roles by `code`, never by name,
// so renaming a role's display name never breaks access control — used here to make the visible
// portal speak the Directors Submission Portal MVP's language (docs/mvp-directors-portal-plan.md)
// without touching any permission logic: SUBMITTER's `code` is unchanged, only its `name` changed
// to "Director"; REVIEWER_SECRETARIAT's `name` is "Corporate Secretary" (the client's later,
// more specific wording — see #A18 — superseding the earlier "Corporate Services Director" label).
// The pre-existing `DIRECTOR` code (department workplan oversight, a later module) is
// disambiguated in display as "Department Director (Workplans)" so the two don't read as the
// same role in admin listings.
//
// `securityGroupName` (optional, set on the 4 roles the client asked to have a mirroring NICTA
// Microsoft 365 / Entra ID security group) is the exact display name that group should have in
// NICTA's tenant, per the client's own naming — including their spelling "Secretariate" on the
// Corporate Secretariat group, kept verbatim since it's an external-facing identifier, not this
// app's internal display copy. It is documentation/provisioning input only: see
// scripts/provision-graph-security-groups.ts and docs/graph-security-groups-guide.md. Group
// membership does NOT drive in-app authorization — that stays entirely DB-driven via
// Role/UserRole (#A4) — these groups are a tenant-side mirror for M365's own tooling (Outlook/
// SharePoint permissions, admin's people-management screens), not a second source of truth.
export const SEED_ROLES = [
  { code: 'SUBMITTER', name: 'Director', securityGroupName: 'NICTA-Portal-Directors' },
  {
    code: 'REVIEWER_SECRETARIAT',
    name: 'Corporate Secretary',
    securityGroupName: 'NICTA-Portal-Corporate-Secretariate',
  },
  { code: 'MANAGER', name: 'Manager' },
  { code: 'DIRECTOR', name: 'Department Director (Workplans)' },
  { code: 'SMC_SECRETARIAT', name: 'OCEO / SMC Secretariat' },
  { code: 'SMC_MEMBER', name: 'SMC Member' },
  { code: 'BOARD_SECRETARIAT', name: 'Board Secretariat' },
  { code: 'BOARD_MEMBER', name: 'Board Member' },
  {
    code: 'EXECUTIVE_VIEWER',
    name: 'CEO / Executive Viewer',
    securityGroupName: 'NICTA-Portal-CEO',
  },
  {
    code: 'SYSTEM_ADMIN',
    name: 'System Administrator',
    securityGroupName: 'NICTA-Portal-Administrators',
  },
] as const;

export type RoleCode = (typeof SEED_ROLES)[number]['code'];

export const ROLE_LANDING_PAGE: Record<RoleCode, string> = {
  SUBMITTER: '/submissions',
  REVIEWER_SECRETARIAT: '/review-queue',
  MANAGER: '/my-workplan',
  DIRECTOR: '/department-dashboard',
  SMC_SECRETARIAT: '/smc/dashboard',
  SMC_MEMBER: '/smc/dashboard',
  BOARD_SECRETARIAT: '/board/dashboard',
  BOARD_MEMBER: '/board-papers',
  EXECUTIVE_VIEWER: '/executive-dashboard',
  SYSTEM_ADMIN: '/admin',
};

// Priority order used to pick the default landing page for a user with multiple roles
// (section 4: "Users with multiple roles must be able to switch between their authorized
// workspaces" — this only decides which workspace they land on first after login).
export const ROLE_LANDING_PRIORITY: RoleCode[] = [
  'SUBMITTER',
  'REVIEWER_SECRETARIAT',
  'BOARD_MEMBER',
  'MANAGER',
  'DIRECTOR',
  'SMC_SECRETARIAT',
  'BOARD_SECRETARIAT',
  'SMC_MEMBER',
  'EXECUTIVE_VIEWER',
  'SYSTEM_ADMIN',
];
