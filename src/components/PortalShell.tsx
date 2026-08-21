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
  children,
}: {
  user: AuthenticatedUser;
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PortalHeader user={user} />
      <div className="flex flex-1">
        <PortalSidebar user={user} active={active} />
        <main className="relative flex-1 overflow-x-hidden bg-nicta-cream">
          <DashboardPattern />
          <div className="relative z-10 mx-auto max-w-6xl px-8 py-8">{children}</div>
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
