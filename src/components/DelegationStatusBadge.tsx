import { isOverdue } from '@/lib/delegations/workflow';
import type { Delegation } from '@prisma/client';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  ISSUED: 'Issued',
  ACKNOWLEDGED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  AT_RISK: 'At Risk',
  SUBMITTED_FOR_REVIEW: 'Submitted for Review',
  RETURNED_FOR_MORE_WORK: 'Returned for More Work',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

const STATUS_TONES: Record<string, string> = {
  DRAFT: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  ISSUED: 'bg-status-warning-bg text-status-warning',
  ACKNOWLEDGED: 'bg-status-warning-bg text-status-warning',
  IN_PROGRESS: 'bg-status-warning-bg text-status-warning',
  AT_RISK: 'bg-status-danger-bg text-status-danger',
  SUBMITTED_FOR_REVIEW: 'bg-status-warning-bg text-status-warning',
  RETURNED_FOR_MORE_WORK: 'bg-status-danger-bg text-status-danger',
  COMPLETED: 'bg-status-success-bg text-status-success',
  CLOSED: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  CANCELLED: 'bg-nicta-neutral-100 text-nicta-neutral-700',
};

export function DelegationStatusBadge({
  delegation,
}: {
  delegation: Pick<Delegation, 'status' | 'dueDate'>;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONES[delegation.status] ?? 'bg-nicta-neutral-100 text-nicta-neutral-700'}`}
      >
        {STATUS_LABELS[delegation.status] ?? delegation.status}
      </span>
      {isOverdue(delegation) && (
        <span className="rounded-full bg-status-danger-bg px-2.5 py-1 text-[11px] font-bold text-status-danger">
          Overdue
        </span>
      )}
    </span>
  );
}
