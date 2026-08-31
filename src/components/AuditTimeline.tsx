// #A32 — generalizes the transition-history timeline first built inline on the Delegation detail
// page (src/app/delegations/[id]/page.tsx) into a shared component, reused by Milestones/Weekly
// Reports/Memos/SEMC items — every one of them writes the same shape (fromState/toState/
// performedBy/performedAt/comment) via WorkflowTransition.
export interface AuditTimelineEntry {
  id: string;
  fromState: string;
  toState: string;
  performedByName: string;
  performedAt: Date;
  comment?: string | null;
}

export function AuditTimeline({ entries }: { entries: AuditTimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-xs text-nicta-neutral-700">No history recorded yet.</p>;
  }
  return (
    <ol className="space-y-4 border-l-2 border-nicta-neutral-200 pl-4">
      {entries.map((t) => (
        <li key={t.id}>
          <p className="text-sm font-medium text-nicta-teal-dark">
            {t.fromState === t.toState ? humanize(t.toState) : `${humanize(t.fromState)} → ${humanize(t.toState)}`}
          </p>
          <p className="text-xs text-nicta-neutral-700">
            {t.performedByName} · {t.performedAt.toLocaleString()}
          </p>
          {t.comment && <p className="mt-1 text-sm text-nicta-neutral-700">{t.comment}</p>}
        </li>
      ))}
    </ol>
  );
}

function humanize(value: string): string {
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}
