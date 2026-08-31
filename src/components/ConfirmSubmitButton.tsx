'use client';

// #A32 — a minimal client-side confirmation for destructive/irreversible form actions (Reject,
// Cancel, Withdraw) — a native browser confirm() rather than a custom modal component, so it works
// as a plain progressive-enhancement wrapper around an existing server-action <form> without
// adding client state management to pages that are otherwise Server Components.
export function ConfirmSubmitButton({
  label,
  confirmMessage,
  className,
}: {
  label: string;
  confirmMessage: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
