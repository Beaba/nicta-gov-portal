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
  CalendarIcon,
  ClockIcon,
  ShieldCheckIcon,
  SearchIcon,
  AlertTriangleIcon,
  SettingsIcon,
} from '@/components/icons';

// #A29 (2026-08-25): the client's spec explicitly requires CEO and Corporate Secretariat to have
// their own distinct navigation — "Do not use one generic sidebar for all roles" — superseding
// #A28's "same nav for everyone" simplicity for those two roles specifically. Director/Manager/
// Board/Admin keep #A28's nav (DefaultNav below) since the client gave no distinct list for them
// this round. Every list below is exactly the client's own item names/order; items with no backing
// route/feature render as disabled "Soon" placeholders rather than being silently dropped.
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
  const isCeo = user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER');
  const isSecretariat = user.roles.some((r) => r.roleCode === 'REVIEWER_SECRETARIAT');
  const isDirector = user.roles.some((r) => r.roleCode === 'SUBMITTER');
  const isBoard = user.roles.some(
    (r) => r.roleCode === 'BOARD_MEMBER' || r.roleCode === 'BOARD_SECRETARIAT',
  );

  const [department, portalRoleName, ceoApprovalCount, boardApprovalCount] = await Promise.all([
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
          'BOARD_SECRETARIAT',
          'SYSTEM_ADMIN',
        ].includes(r.roleCode),
      )?.roleName,
    ),
    isCeo ? countCeoApprovalInbox() : Promise.resolve(0),
    isBoard && user.roles.some((r) => r.roleCode === 'BOARD_MEMBER')
      ? countBoardApprovalInbox(user.id)
      : Promise.resolve(0),
  ]);

  return (
    <nav className="relative flex w-64 shrink-0 flex-col overflow-y-auto bg-nicta-teal-dark px-4 py-6">
      <SidebarPattern />

      <ul className="relative z-10 space-y-1">
        {isCeo ? (
          <CeoNav active={active} approvalCount={ceoApprovalCount} />
        ) : isSecretariat ? (
          <SecretariatNav active={active} />
        ) : isBoard ? (
          <BoardNav active={active} approvalCount={boardApprovalCount} />
        ) : (
          <DefaultNav primaryHref={primaryHref} active={active} isDirector={isDirector} />
        )}
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

// ---------------------------------------------------------------------------
// Director / Manager / Board / Admin — #A28's original nav, unchanged except
// "Executive Delegations" is now a real link for Directors (SUBMITTER), since #A29 builds the
// CEO -> Director delegation workflow those Directors act on.
// ---------------------------------------------------------------------------
function DefaultNav({
  primaryHref,
  active,
  isDirector,
}: {
  primaryHref: string;
  active?: string;
  isDirector: boolean;
}) {
  const isBoardPapersActive = active === 'board-papers';
  const isDashboardActive = !isBoardPapersActive;

  return (
    <>
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
        {isDirector ? (
          <SidebarLink
            href="/delegations"
            label="Executive Delegations"
            icon={PeopleIcon}
            active={active === 'delegations'}
          />
        ) : (
          <DisabledSidebarLink label="Executive Delegations" icon={PeopleIcon} />
        )}
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
        <SignOutButton />
      </li>
    </>
  );
}

// ---------------------------------------------------------------------------
// CEO — #A31 rebuild to match the approved CEO Dashboard mockup exactly: one flat 11-item list
// (no section headers, no "Soon" placeholders — every item here has a real destination), replacing
// #A29's grouped, mostly-placeholder version. "SMC Submissions" and "Board Papers" reuse existing
// pages exactly as #A29 already did; "Departments"/"Performance & KPIs"/"Approval Inbox"/
// "CEO Comments" are new pages built this pass (#A31); "Delegated Tasks" reuses the existing
// Delegation feature (#A29) rather than a new parallel model, matching the client's "do not
// duplicate" instruction; "Archive" reuses the Board module's read-only archive (#A30), widened to
// admit the CEO's oversight role.
function CeoNav({ active, approvalCount }: { active?: string; approvalCount: number }) {
  return (
    <>
      <li>
        <SidebarLink
          href="/executive-dashboard"
          label="Executive Overview"
          icon={HomeIcon}
          active={!active || active === 'executive-dashboard'}
        />
      </li>
      <li>
        <SidebarLink
          href="/executive-dashboard/departments"
          label="Departments"
          icon={PeopleIcon}
          active={active === 'executive-departments'}
        />
      </li>
      <li>
        <SidebarLink
          href="/executive-dashboard/performance"
          label="Performance &amp; KPIs"
          icon={ChartIcon}
          active={active === 'executive-performance'}
        />
      </li>
      <li>
        <SidebarLink
          href="/executive-dashboard"
          label="SMC Submissions"
          icon={PaperPlaneIcon}
          active={false}
        />
      </li>
      <li>
        <SidebarLink
          href="/board-papers"
          label="Board Papers"
          icon={ShieldCheckIcon}
          active={active === 'board-papers'}
        />
      </li>
      <li>
        <SidebarLink
          href="/executive-dashboard/approvals"
          label="Approval Inbox"
          icon={InboxIcon}
          active={active === 'executive-approvals'}
          badge={approvalCount}
        />
      </li>
      <li>
        <SidebarLink
          href="/executive-dashboard/comments"
          label="CEO Comments"
          icon={PersonCheckIcon}
          active={active === 'executive-comments'}
        />
      </li>
      <li>
        <SidebarLink
          href="/delegations"
          label="Delegated Tasks"
          icon={ClockIcon}
          active={active === 'delegations'}
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
      <li>
        <SidebarLink
          href="/board/archive"
          label="Archive"
          icon={ArchiveIcon}
          active={active === 'board-archive'}
        />
      </li>
      <li>
        <SignOutButton />
      </li>
    </>
  );
}

// ---------------------------------------------------------------------------
// Corporate Secretariat — #A29. Real links: Secretariat Dashboard, Notifications, SMC Submission
// Queue, Board Paper Register, Deadlines and Submission Windows, Approved Templates (all existing
// /review-queue, /board-papers, /admin, /admin/templates routes), Sign Out.
// ---------------------------------------------------------------------------
function SecretariatNav({ active }: { active?: string }) {
  return (
    <>
      <SectionLabel>Overview</SectionLabel>
      <li>
        <SidebarLink
          href="/review-queue"
          label="Secretariat Dashboard"
          icon={HomeIcon}
          active={active !== 'board-papers'}
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
      <li>
        <DisabledSidebarLink label="Pending Actions" icon={SearchIcon} />
      </li>

      <SectionLabel>Calendar</SectionLabel>
      <li>
        <DisabledSidebarLink label="SMC Calendar" icon={CalendarIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Board Calendar" icon={CalendarIcon} />
      </li>

      <SectionLabel>SMC &amp; Board</SectionLabel>
      <li>
        <SidebarLink
          href="/review-queue"
          label="SMC Submission Queue"
          icon={PaperPlaneIcon}
          active={false}
        />
      </li>
      <li>
        <SidebarLink
          href="/board-papers"
          label="Board Paper Register"
          icon={ShieldCheckIcon}
          active={active === 'board-papers'}
        />
      </li>
      <li>
        <DisabledSidebarLink label="Board Agenda and Pack" icon={DocumentIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="CEO Review Queue" icon={PersonCheckIcon} />
      </li>

      <SectionLabel>Governance Admin</SectionLabel>
      <li>
        <DisabledSidebarLink label="Circulars" icon={RefreshIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Delegations" icon={PeopleIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Requests" icon={InboxIcon} />
      </li>
      <li>
        <SidebarLink
          href="/admin"
          label="Deadlines and Submission Windows"
          icon={ClockIcon}
          active={false}
        />
      </li>
      <li>
        <SidebarLink
          href="/admin/templates"
          label="Approved Templates"
          icon={DocumentIcon}
          active={false}
        />
      </li>
      <li>
        <DisabledSidebarLink label="Paper Standards and Guidance" icon={DocumentIcon} />
      </li>

      <SectionLabel>Records &amp; Archive</SectionLabel>
      <li>
        <DisabledSidebarLink label="Meeting Minutes" icon={DocumentIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Board Resolutions" icon={ShieldCheckIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="SMC Decisions" icon={ShieldCheckIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Board Archive" icon={ArchiveIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Document Register" icon={DocumentIcon} />
      </li>

      <SectionLabel>Reports</SectionLabel>
      <li>
        <DisabledSidebarLink label="Submission Status Reports" icon={ChartIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Late Submission Reports" icon={ClockIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Board Pipeline Reports" icon={ChartIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Delegation Reports" icon={ChartIcon} />
      </li>
      <li>
        <DisabledSidebarLink label="Department Reporting Compliance" icon={ChartIcon} />
      </li>

      <SectionLabel>Settings</SectionLabel>
      <li>
        <DisabledSidebarLink label="Settings" icon={SettingsIcon} />
      </li>
      <li>
        <SignOutButton />
      </li>
    </>
  );
}

// ---------------------------------------------------------------------------
// Board Member / Board Secretariat — #A30. One shared nav for both roles (the client's Board
// Dashboard spec, unlike #A29's CEO/Secretariat spec, describes different *dashboard content and
// actions* per role, not a different *navigation structure* — so this stays one nav, differentiated
// inside each page the same way /review-queue and /delegations already differentiate CEO vs
// Secretariat content on one route). Real links only — every item here has a working destination.
// ---------------------------------------------------------------------------
// #A31 rebuild to match the approved Board Dashboard mockup exactly: one flat 10-item list ending
// in Sign Out, no "Notifications"/"Settings" items (the header's bell icon already covers
// notifications, matching the mockup) and no section headers. "Approval Inbox"/"Comments"/
// "Minutes" are new pages built this pass; "Meetings"/"Agenda & Papers"(renamed from "Board
// Papers")/"Resolutions"/"Actions"(renamed from "Action Tracker")/"Archive" reuse #A30's existing
// pages exactly, just relabelled to match the mockup's wording.
function BoardNav({ active, approvalCount }: { active?: string; approvalCount: number }) {
  return (
    <>
      <li>
        <SidebarLink
          href="/board/dashboard"
          label="Dashboard"
          icon={HomeIcon}
          active={!active || active === 'board-dashboard'}
        />
      </li>
      <li>
        <SidebarLink
          href="/board/meetings"
          label="Meetings"
          icon={CalendarIcon}
          active={active === 'board-meetings'}
        />
      </li>
      <li>
        <SidebarLink
          href="/board-papers"
          label="Agenda &amp; Papers"
          icon={PaperPlaneIcon}
          active={active === 'board-papers'}
        />
      </li>
      <li>
        <SidebarLink
          href="/board/approvals"
          label="Approval Inbox"
          icon={InboxIcon}
          active={active === 'board-approvals'}
          badge={approvalCount}
        />
      </li>
      <li>
        <SidebarLink
          href="/board/comments"
          label="Comments"
          icon={PersonCheckIcon}
          active={active === 'board-comments'}
        />
      </li>
      <li>
        <SidebarLink
          href="/board/resolutions"
          label="Resolutions"
          icon={ShieldCheckIcon}
          active={active === 'board-resolutions'}
        />
      </li>
      <li>
        <SidebarLink
          href="/board/minutes"
          label="Minutes"
          icon={DocumentIcon}
          active={active === 'board-minutes'}
        />
      </li>
      <li>
        <SidebarLink
          href="/board/actions"
          label="Actions"
          icon={ChartIcon}
          active={active === 'board-actions'}
        />
      </li>
      <li>
        <SidebarLink
          href="/board/archive"
          label="Archive"
          icon={ArchiveIcon}
          active={active === 'board-archive'}
        />
      </li>
      <li>
        <SignOutButton />
      </li>
    </>
  );
}

function SignOutButton() {
  return (
    <form action="/api/auth/signout" method="POST">
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
      >
        <SignOutIcon className="h-4 w-4 shrink-0" />
        Sign Out
      </button>
    </form>
  );
}

// #A31 sidebar badge counts — deliberately plain counts, not a call into the fuller
// listCeoApprovalInbox/listDecisionsForSubmission service functions (those also re-check the
// caller's role, redundant here since PortalSidebar already knows it).
async function countCeoApprovalInbox(): Promise<number> {
  const [smcCount, boardCount] = await Promise.all([
    prisma.submission.count({
      where: {
        submissionCategory: 'SMC',
        workflowStatus: { in: ['ACCEPTED', 'ROUTED'] },
        endorsedForBoard: false,
      },
    }),
    prisma.submission.count({ where: { submissionCategory: 'BOARD', boardOutcome: null } }),
  ]);
  return smcCount + boardCount;
}

async function countBoardApprovalInbox(userId: string): Promise<number> {
  const decisionPapers = await prisma.submission.findMany({
    where: {
      submissionCategory: 'BOARD',
      boardOutcome: null,
      meeting: { status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
    },
    select: { id: true, paperType: true },
  });
  const candidates = decisionPapers.filter((p) => /decision paper/i.test(p.paperType));
  if (candidates.length === 0) return 0;
  const decided = await prisma.decision.findMany({
    where: { submissionId: { in: candidates.map((p) => p.id) }, recordedById: userId },
    select: { submissionId: true },
  });
  const decidedIds = new Set(decided.map((d) => d.submissionId));
  return candidates.filter((p) => !decidedIds.has(p.id)).length;
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
  badge,
}: {
  href: string;
  label: string;
  icon: typeof HomeIcon;
  active: boolean;
  compact?: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${
        compact ? 'py-2' : 'py-2.5'
      } ${active ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {Boolean(badge) && (
        <span className="rounded-full bg-status-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

// Future-module nav item — client requirement: visible so the app's eventual shape is legible, but
// not clickable and visually muted with a "Soon" tag rather than a working link to a stub page (a
// deliberate change from the older ComingSoonPage pattern used for other roles' primary landing
// pages — see docs/known-limitations.md for what each of these still needs).
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
