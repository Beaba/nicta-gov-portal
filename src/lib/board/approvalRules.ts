import type { Decision } from '@prisma/client';

// The client's spec: "Do not mark a paper as finally approved unless the configured approval
// requirements are satisfied. Keep the approval rules configurable so quorum and voting logic can
// be expanded later." No Board membership roster/quorum size is tracked anywhere in this codebase
// yet (attendance is recorded per meeting, but "who is eligible to vote" vs "who showed up" is a
// governance question this MVP doesn't attempt to answer), so a real quorum/majority calculation
// would be guessing at rules the client hasn't specified. This module is the single, isolated place
// that decision — everything else calls evaluateBoardOutcome() rather than inlining vote-counting
// logic, so swapping in real quorum/majority rules later is a one-file change.
export type BoardOutcomeSuggestion =
  'APPROVED' | 'REJECTED' | 'DEFERRED' | 'NEEDS_MORE_INFO' | 'PENDING';

const REJECTING = new Set(['Reject']);
const DEFERRING = new Set(['Defer']);
const NEEDS_INFO = new Set(['RequestFurtherInformation']);
const APPROVING = new Set(['Approve', 'ApproveSubjectToConditions']);
const NON_BLOCKING = new Set(['Abstain', 'DeclareConflictOfInterest']);

/**
 * MVP rule (deliberately simple, see module comment): the *latest* decision per Board Member is
 * used (a changed vote supersedes, per the append-only-history-but-latest-wins convention already
 * established for Delegation votes in #A29). Any Reject -> REJECTED. Else any Defer -> DEFERRED.
 * Else any RequestFurtherInformation -> NEEDS_MORE_INFO. Else, if at least one substantive
 * (Approve/ApproveSubjectToConditions) decision exists and nothing blocking does -> APPROVED. This
 * is a "one voice can approve, one voice can block" placeholder, not real quorum/majority math —
 * the Secretariat still reviews the suggestion and finalizes it manually (finalizeBoardOutcome in
 * papers.ts), it is never auto-applied.
 */
export function evaluateBoardOutcome(
  decisions: Pick<Decision, 'decisionType' | 'recordedById'>[],
): BoardOutcomeSuggestion {
  const latestByUser = new Map<string, string>();
  for (const d of decisions) {
    latestByUser.set(d.recordedById, d.decisionType);
  }
  const types = Array.from(latestByUser.values());
  if (types.length === 0) return 'PENDING';
  if (types.some((t) => REJECTING.has(t))) return 'REJECTED';
  if (types.some((t) => DEFERRING.has(t))) return 'DEFERRED';
  if (types.some((t) => NEEDS_INFO.has(t))) return 'NEEDS_MORE_INFO';
  if (types.some((t) => APPROVING.has(t))) return 'APPROVED';
  if (types.every((t) => NON_BLOCKING.has(t))) return 'PENDING';
  return 'PENDING';
}
