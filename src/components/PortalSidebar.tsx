import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { ROLE_LANDING_PAGE, ROLE_LANDING_PRIORITY } from '@/lib/config/roles';
import { SidebarExpandableGroup } from '@/components/SidebarExpandableGroup';
import {
  HomeIcon,
  BellIcon,
  DocumentIcon,
  PaperPlaneIcon,
  PeopleIcon,
  PersonCheckIcon,
  RefreshIcon,
  ArchiveIcon,
  ChartIcon,
  InboxIcon,
  UserIcon,
  SignOutIcon,
} from '@/components/icons';

// Full nav structure the client asked for (2026-08-23), including the sections that belong to
// modules this MVP doesn't build yet (Delegations, Manager reporting, Archive, Circular/CEO's
// Approval routing, Account) — per the client's own instruction that future modules must be
// "visible only as disabled... placeholders", not hidden, so the eventual shape of the app is
// legible now. Rendered the same for every role, matching #A26's existing "sidebar doesn't vary
// by role" simplicity — only "My Dashboard"/"SMC" (both ROLE_LANDING_PAGE) and "Board Papers"
// carry a working href today.
export async function PortalSidebar({
  user,
  active,
}: {
  user: AuthenticatedUser;
  active?: string;
}) {
  const primaryRole = ROLE_LANDING_PRIORITY.find((role) =>
    user.roles.some((r) => r.roleCode === role),
  );
  const primaryHref = primaryRole ? ROLE_LANDING_PAGE[primaryRole] : '/submissions';
  const isBoardPapersActive = active === 'board-papers';
  const isDashboardActive = !isBoardPapersActive;

  const [department, portalRoleName] = await Promise.all([
    user.departmentId
      ? prisma.department.findUnique({ where: { id: user.departmentId } })
      : Promise.resolve(null),
    Promise.resolve(
      user.roles.find((r) =>
        [
          'SUBMITTER',
          'REVIEWER_SECRETARIAT',
          'EXECUTIVE_VIEWER',
          'BOARD_MEMBER',
          'SYSTEM_ADMIN',
        ].includes(r.roleCode),
      )?.roleName,
    ),
  ]);

  return (
    <nav className="relative flex w-64 shrink-0 flex-col overflow-y-auto bg-nicta-teal-dark px-4 py-6">
      <SidebarPattern />

      <ul className="relative z-10 space-y-1">
        <SectionLabel>Overview</SectionLabel>
        <li>
          <SidebarLink
            href={primaryHref}
            label="My Dashboard"
            icon={HomeIcon}
            active={isDashboardActive}
          />
        </li>
        <li>
          <SidebarLink
            href="/notifications"
            label="Notifications"
            icon={BellIcon}
            active={active === 'notifications'}
          />
        </li>

        <SectionLabel>Submissions</SectionLabel>
        <SidebarExpandableGroup
          label="New Submissions"
          icon={<DocumentIcon className="h-4 w-4 shrink-0" />}
          defaultOpen
        >
          <li>
            <SidebarLink
              href={primaryHref}
              label="SMC"
              icon={PaperPlaneIcon}
              active={false}
              compact
            />
          </li>
          <li>
            <SidebarLink
              href="/board-papers"
              label="Board"
              icon={PeopleIcon}
              active={isBoardPapersActive}
              compact
            />
          </li>
          <li>
            <DisabledSidebarLink label="CEO's Approval" icon={PersonCheckIcon} compact />
          </li>
          <li>
            <DisabledSidebarLink label="Circular Approval" icon={RefreshIcon} compact />
          </li>
        </SidebarExpandableGroup>
        <li>
          <DisabledSidebarLink label="Archive" icon={ArchiveIcon} />
        </li>

        <SectionLabel>Directors Tasks</SectionLabel>
        <li>
          <DisabledSidebarLink label="Executive Delegations" icon={PeopleIcon} />
        </li>
        <li>
          <DisabledSidebarLink label="Managers Delegations" icon={PeopleIcon} />
        </li>

        <SectionLabel>Department Managers</SectionLabel>
        <li>
          <DisabledSidebarLink label="Reports" icon={ChartIcon} />
        </li>
        <li>
          <DisabledSidebarLink label="Requests" icon={InboxIcon} />
        </li>

        <SectionLabel>Settings</SectionLabel>
        <li>
          <DisabledSidebarLink label="Account" icon={UserIcon} />
        </li>
        <li>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <SignOutIcon className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </form>
        </li>
      </ul>

      <div className="relative z-10 mt-6 border-t border-white/10 pt-4">
        <div className="flex items-center gap-3 px-1">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold text-white">
            {user.name.charAt(0)}
          </span>
          <div className="min-w-0 text-xs leading-tight">
            <p className="truncate font-semibold text-white">{user.name}</p>
            <p className="truncate text-white/60">
              {[portalRoleName, department?.name].filter(Boolean).join(' ')}
            </p>
          </div>
        </div>
      </div>
    </nav>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <li className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wider text-white/40 first:pt-0">
      {children}
    </li>
  );
}

function SidebarLink({
  href,
  label,
  icon: Icon,
  active,
  compact,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  active: boolean;
  compact?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
        compact ? 'py-2' : 'py-2.5'
      } ${active ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

// Future-module nav item — client requirement (2026-08-23): visible so the app's eventual shape
// is legible, but not clickable and visually muted with a "Soon" tag rather than a working link
// to a stub page (a deliberate change from the older ComingSoonPage pattern used for other roles'
// primary landing pages — see docs/known-limitations.md for what each of these still needs).
function DisabledSidebarLink({
  label,
  icon: Icon,
  compact,
}: {
  label: string;
  icon: typeof HomeIcon;
  compact?: boolean;
}) {
  return (
    <span
      aria-disabled="true"
      title="Coming in a future milestone"
      className={`flex cursor-not-allowed items-center gap-3 rounded-md px-3 text-sm font-medium text-white/35 ${
        compact ? 'py-2' : 'py-2.5'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white/50">
        Soon
      </span>
    </span>
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
