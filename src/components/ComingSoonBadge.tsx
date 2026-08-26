// #A31 — small inline "future module" indicator, distinct from the sidebar's DisabledSidebarLink
// "Soon" tag (that marks a whole nav item; this marks one action/row within an otherwise-working
// panel, e.g. "Digital signature — coming soon" next to a real Approve button).
export function ComingSoonBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-nicta-neutral-200 bg-nicta-neutral-50 px-2.5 py-1 text-xs text-nicta-neutral-700">
      <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
        <rect x="5" y="11" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path
          d="M8 11V7.5a4 4 0 1 1 8 0V11"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
      {label} — Coming Soon
    </span>
  );
}
