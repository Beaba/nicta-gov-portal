// #A32 — shared empty/error/permission-denied states, reused across every new CEO Portal screen
// instead of each page inventing its own <p> (the pattern most existing pages used before this
// pass — see executive-dashboard/page.tsx's own inline EmptyState, now superseded by this shared
// one for new screens; the old inline one is left as-is on the pages that already used it, per
// "don't touch working functionality").
export function EmptyState({
  title = 'Nothing here yet',
  description,
  icon,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
      {icon && <span className="text-nicta-neutral-700">{icon}</span>}
      <p className="text-sm font-medium text-nicta-teal-dark">{title}</p>
      {description && <p className="max-w-sm text-xs text-nicta-neutral-700">{description}</p>}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Try refreshing the page. If the problem continues, contact your Administrator.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-status-danger-bg bg-status-danger-bg/40 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-status-danger">{title}</p>
      <p className="max-w-sm text-xs text-nicta-neutral-700">{description}</p>
    </div>
  );
}

export function PermissionDeniedState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-nicta-neutral-200 bg-white px-5 py-10 text-center">
      <p className="text-sm font-semibold text-nicta-teal-dark">You don&rsquo;t have access to this</p>
      <p className="max-w-sm text-xs text-nicta-neutral-700">
        This area is restricted to authorised roles. Contact your Administrator if you believe this
        is incorrect.
      </p>
    </div>
  );
}

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-nicta-neutral-100" />
      ))}
    </div>
  );
}
