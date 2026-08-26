export function DashboardStatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  icon: (props: { className?: string }) => React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-white p-5 shadow-sm">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-nicta-teal-light text-nicta-teal-dark">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm text-nicta-neutral-700">{label}</p>
        <p className="text-2xl font-bold text-nicta-teal-dark">{value}</p>
      </div>
    </div>
  );
}
