import { RISK_STATUS_ICON, RISK_STATUS_LABEL, type DepartmentRiskStatus } from '@/lib/performance/riskService';

// #A32 — the client's explicit "Do not rely on colour alone" traffic-light requirement: every
// rendering carries colour + text + a distinct icon shape (not just a coloured dot). Single shared
// component so every screen (Department Status, Milestones, Weekly Overview) renders identically —
// per the client's "traffic-light calculations must come from a reusable service... do not
// calculate them separately inside UI components," this component only renders the status
// riskService.ts already computed; it performs no threshold logic of its own.
const TONE: Record<DepartmentRiskStatus, string> = {
  ON_TRACK: 'bg-status-success-bg text-status-success',
  AT_RISK: 'bg-status-warning-bg text-status-warning',
  CRITICAL: 'bg-status-danger-bg text-status-danger',
  NO_DATA: 'bg-nicta-neutral-100 text-nicta-neutral-700',
};

function Glyph({ shape, className }: { shape: 'check' | 'warning' | 'alert' | 'dash'; className?: string }) {
  const paths: Record<typeof shape, React.ReactNode> = {
    check: <path d="M5 12.5 9.5 17 19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />,
    warning: (
      <path
        d="M12 4 22 20H2L12 4Z M12 10v4 M12 17h.01"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" fill="none" />
        <path d="M12 7.5v5.5 M12 16.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
    dash: <path d="M6 12h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  };
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {paths[shape]}
    </svg>
  );
}

export function TrafficLight({
  status,
  compact = false,
}: {
  status: DepartmentRiskStatus;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full font-medium ${TONE[status]} ${
        compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Glyph shape={RISK_STATUS_ICON[status]} className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {RISK_STATUS_LABEL[status]}
    </span>
  );
}
