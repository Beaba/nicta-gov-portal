import Link from 'next/link';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { ROLE_LANDING_PAGE, ROLE_LANDING_PRIORITY } from '@/lib/config/roles';
import { DocumentIcon, CalendarIcon, SignOutIcon } from '@/components/icons';

// Dark-teal left nav, per the client's approved dashboard reference — deliberately just 2 items
// regardless of role ("SMC Submissions" and "Board Papers"), matching the reference exactly. Every
// role's own primary workspace (Director -> /submissions, Corporate Secretary -> /review-queue,
// CEO -> /executive-dashboard, System Admin -> /admin) sits behind the same "SMC Submissions" label
// — reusing ROLE_LANDING_PAGE/PRIORITY (the same lookup the post-login redirect already uses) so
// this never drifts out of sync with where each role actually lands. Administration has no
// standalone nav item in the reference; it's reachable via the Corporate Secretariat dashboard's
// own "Set SMC Deadline"/"Manage Approved Templates" buttons instead.
export function PortalSidebar({ user, active }: { user: AuthenticatedUser; active?: string }) {
  const primaryRole = ROLE_LANDING_PRIORITY.find((role) =>
    user.roles.some((r) => r.roleCode === role),
  );
  const primaryHref = primaryRole ? ROLE_LANDING_PAGE[primaryRole] : '/submissions';
  const isBoardPapersActive = active === 'board-papers';

  return (
    <nav className="relative flex w-64 shrink-0 flex-col overflow-hidden bg-nicta-teal-dark px-4 py-6">
      <SidebarPattern />

      <ul className="relative z-10 space-y-1">
        <li>
          <SidebarLink
            href={primaryHref}
            label="SMC Submissions"
            icon={DocumentIcon}
            active={!isBoardPapersActive}
          />
        </li>
        <li>
          <SidebarLink
            href="/board-papers"
            label="Board Papers"
            icon={CalendarIcon}
            active={isBoardPapersActive}
          />
        </li>
      </ul>

      <div className="relative z-10 mt-auto">
        <div className="relative mb-6 h-24 w-px bg-nicta-sand/50">
          <span className="absolute -left-[3px] top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-nicta-sand" />
        </div>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-white/90 transition-colors hover:bg-white/10"
          >
            <SignOutIcon className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: typeof DocumentIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
        active ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

// Same faint concentric-ring language as the login page (LoginPatternRings) — deliberately reused
// rather than a new motif, so the authenticated portal and the login page read as one system.
function SidebarPattern() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 bottom-0 h-72 w-full opacity-60"
      viewBox="0 0 300 400"
      preserveAspectRatio="xMidYMax slice"
    >
      <g stroke="#F4EFE3" strokeOpacity="0.12" fill="none">
        <circle cx="60" cy="420" r="180" strokeWidth="1.2" />
        <circle cx="60" cy="420" r="130" strokeWidth="1" />
        <circle cx="60" cy="420" r="85" strokeWidth="1" />
      </g>
    </svg>
  );
}
