// #A32 — SEMC role gates, mirroring src/lib/board/roles.ts's exact shape for the Board module.
// A parallel, SEMC-specific module rather than parametrizing board/roles.ts — the client's own
// spec keeps SEMC and Board as textually distinct workflows ("Do not use SMC in newly implemented
// CEO functionality" alongside a separate, still-standing Board module), and board/roles.ts's
// consumers (board/meetings.ts, resolutions.ts, decisions.ts, minutes.ts) are already
// tested/shipped — not touched here, per "do not replace working ... Board functionality."
//
// SEMC permanent participants (client's own list): CEO as Chairperson, all Directors, Corporate
// Secretariat (= SEMC Secretariat), other participants when invited (SMC_MEMBER covers this).
export const SEMC_CHAIR_ROLES = ['EXECUTIVE_VIEWER', 'SYSTEM_ADMIN'] as const;
export const SEMC_SECRETARIAT_ROLES = ['REVIEWER_SECRETARIAT', 'SMC_SECRETARIAT', 'SYSTEM_ADMIN'] as const;
export const SEMC_DIRECTOR_ROLES = ['SUBMITTER', 'SYSTEM_ADMIN'] as const;
export const SEMC_MEMBER_ROLES = ['SMC_MEMBER', 'SYSTEM_ADMIN'] as const;
export const SEMC_ANY_ROLES = [
  'EXECUTIVE_VIEWER',
  'REVIEWER_SECRETARIAT',
  'SMC_SECRETARIAT',
  'SUBMITTER',
  'SMC_MEMBER',
  'SYSTEM_ADMIN',
] as const;
