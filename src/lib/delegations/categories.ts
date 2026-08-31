// #A32 — the client's 10 named delegation categories. Free-text list (Delegation.category is a
// plain string, not an enum), same reasoning as every other lookup-list-as-string in this codebase
// (#A9) — a new category never needs a migration.
export const DELEGATION_CATEGORIES = [
  'Task',
  'Work Activity',
  'Event Attendance',
  'Meeting Representation',
  'Invitation',
  'Document Review',
  'Information Request',
  'Follow-up Action',
  'Recurring Task',
  'Other',
] as const;

export type DelegationCategory = (typeof DELEGATION_CATEGORIES)[number];
