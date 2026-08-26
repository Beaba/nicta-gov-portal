// Shared role gates for the Board Dashboard module (#A30). SYSTEM_ADMIN is included everywhere,
// same emergency-override precedent as every other role gate in this codebase
// (review.ts's CEO_ROLES/REVIEWER_ROLES, delegations.ts's CEO_ROLES/DIRECTOR_ROLES).
export const BOARD_MEMBER_ROLES = ['BOARD_MEMBER', 'SYSTEM_ADMIN'] as const;
export const BOARD_SECRETARIAT_ROLES = ['BOARD_SECRETARIAT', 'SYSTEM_ADMIN'] as const;
export const BOARD_ANY_ROLES = ['BOARD_MEMBER', 'BOARD_SECRETARIAT', 'SYSTEM_ADMIN'] as const;
