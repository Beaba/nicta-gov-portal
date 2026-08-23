'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '@/components/icons';

// The sidebar's only interactive nav element (everything else is a plain Link) — isolated into
// its own client component so PortalSidebar itself can stay an async Server Component and fetch
// the signed-in user's department name directly, the same way PortalHeader already fetches its
// own notification count. `icon` is a rendered node, not a component reference — a Server
// Component can't pass a function prop across to a Client Component, only serializable props/JSX.
export function SidebarExpandableGroup({
  label,
  icon,
  defaultOpen = false,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <ul className="mt-1 space-y-1 pl-4">{children}</ul>}
    </li>
  );
}
