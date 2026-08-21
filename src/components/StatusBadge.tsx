import type { Submission } from '@prisma/client';

// Maps the internal workflow state machine (docs/mvp-directors-portal-plan.md) to the display
// vocabulary shown in the reference design — pastel-background pills. Category-aware: a BOARD
// paper's SUBMITTED status reads "Submitted to Board", not "Submitted to SMC". `endorsedForBoard`
// (SEMC's decision that a Board Paper should be prepared — #A18) is checked first on SMC papers
// since it's the more informative thing to show once set, even though the underlying
// workflowStatus is still ACCEPTED/ROUTED underneath.
const SMC_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted to SMC',
  AI_REVIEWED: 'Submitted to SMC',
  SECRETARIAT_REVIEW: 'Submitted to SMC',
  RETURNED: 'Returned for Correction',
  ACCEPTED: 'Noted',
  ROUTED: 'Routed',
  CLOSED: 'Closed',
};

const BOARD_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted to Board',
  CLOSED: 'Closed',
};

const STATUS_TONES: Record<string, string> = {
  DRAFT: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  SUBMITTED: 'bg-status-warning-bg text-status-warning',
  AI_REVIEWED: 'bg-status-warning-bg text-status-warning',
  SECRETARIAT_REVIEW: 'bg-status-warning-bg text-status-warning',
  RETURNED: 'bg-status-danger-bg text-status-danger',
  ACCEPTED: 'bg-status-success-bg text-status-success',
  ROUTED: 'bg-status-success-bg text-status-success',
  CLOSED: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  ENDORSED: 'bg-status-success-bg text-status-success',
};

export function StatusBadge({
  submission,
}: {
  submission: Pick<Submission, 'workflowStatus' | 'endorsedForBoard' | 'submissionCategory'>;
}) {
  const isBoard = submission.submissionCategory === 'BOARD';
  const showEndorsed = !isBoard && submission.endorsedForBoard;

  const key = showEndorsed ? 'ENDORSED' : submission.workflowStatus;
  const label = showEndorsed
    ? 'Endorsed for Board'
    : ((isBoard ? BOARD_STATUS_LABELS : SMC_STATUS_LABELS)[submission.workflowStatus] ??
      submission.workflowStatus);

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONES[key] ?? 'bg-nicta-neutral-100 text-nicta-neutral-700'}`}
    >
      {label}
    </span>
  );
}
