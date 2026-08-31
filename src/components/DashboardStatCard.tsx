export function DashboardStatCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
  compact = false,
}: {
  label: string;
  value: number | string;
  icon: (props: { className?: string }) => React.ReactNode;
  tone?: 'default' | 'danger';
  compact?: boolean;
}) {
  const toneClasses =
    tone === 'danger'
      ? 'bg-status-danger-bg text-status-danger'
      : 'bg-nicta-teal-light text-nicta-teal-dark';

  return (
    <div
      className={`flex min-w-0 items-center border border-nicta-neutral-200 bg-white shadow-[0_2px_8px_rgba(21,60,68,0.05)] ${
        compact ? 'gap-3 rounded-lg px-3 py-3.5' : 'gap-4 rounded-xl p-5'
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-full ${toneClasses} ${
          compact ? 'h-10 w-10' : 'h-12 w-12'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p
          className={`${compact ? 'text-[11px] leading-tight' : 'text-sm'} font-medium text-nicta-neutral-900`}
        >
          {label}
        </p>
        <p
          className={`${compact ? 'mt-1 text-2xl' : 'text-2xl'} font-semibold ${
            tone === 'danger' ? 'text-status-danger' : 'text-nicta-teal-dark'
          }`}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
