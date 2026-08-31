import type { AuthenticatedUser } from '@/lib/auth/types';
import { PortalHeader } from '@/components/PortalHeader';
import { PortalSidebar } from '@/components/PortalSidebar';

// Drop-in replacement for the old top-nav-only AppHeader (see docs/assumptions-and-decisions.md#A26):
// white PortalHeader across the full width, PortalSidebar down the left, and a warm-cream content
// area to its right. `active` keeps the same meaning callers already pass to AppHeader ('submissions'
// | 'review-queue' | 'executive-dashboard' | 'admin' | 'board-papers' | ...) — PortalSidebar only
// distinguishes "board-papers" from everything else, per the reference's 2-item nav.
export function PortalShell({
  user,
  active,
  variant = 'default',
  children,
}: {
  user: AuthenticatedUser;
  active?: string;
  variant?: 'default' | 'executive';
  children: React.ReactNode;
}) {
  const isExecutive = variant === 'executive';

  return (
    <div className="flex min-h-screen flex-col">
      <PortalHeader user={user} />
      <div className="flex flex-1">
        {/* #A32 — pure-CSS mobile nav toggle (no client component needed): PortalHeader renders a
            hamburger <label htmlFor="mobile-nav-toggle"> (label/htmlFor works regardless of DOM
            position); the checkbox itself must be a direct sibling of the elements using
            `peer-checked:` for Tailwind's peer selector to match, so it lives here. */}
        <input type="checkbox" id="mobile-nav-toggle" className="peer hidden" aria-hidden="true" />
        <div className="fixed inset-0 z-40 hidden bg-black/40 peer-checked:block lg:hidden">
          <label htmlFor="mobile-nav-toggle" className="absolute inset-0" aria-label="Close menu" />
        </div>
        <div className="fixed inset-y-0 left-0 z-50 -translate-x-full transition-transform duration-200 peer-checked:translate-x-0 lg:static lg:translate-x-0">
          <PortalSidebar user={user} active={active} />
        </div>
        <main
          className={`relative min-w-0 flex-1 overflow-x-hidden ${
            isExecutive ? 'bg-[#fbfaf7]' : 'bg-nicta-cream'
          }`}
        >
          {!isExecutive && <DashboardPattern />}
          <div
            className={`relative z-10 mx-auto ${
              isExecutive ? 'max-w-[1380px] px-5 py-5 xl:px-7' : 'max-w-6xl px-8 py-8'
            }`}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

// Very faint cultural-line-pattern wash on the cream content area, matching the reference's
// textured background — abstract/original, same rule as every other decorative pattern in this
// app (LoginPatternRings, PortalSidebar's SidebarPattern): not a reproduction of a specific design.
function DashboardPattern() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.05]"
      viewBox="0 0 800 800"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <pattern id="dashboard-weave" width="70" height="70" patternUnits="userSpaceOnUse">
          <path
            d="M0 35 L17.5 17.5 L35 35 L17.5 52.5 Z M35 35 L52.5 17.5 L70 35 L52.5 52.5 Z"
            fill="none"
            stroke="#153C44"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dashboard-weave)" />
    </svg>
  );
}
