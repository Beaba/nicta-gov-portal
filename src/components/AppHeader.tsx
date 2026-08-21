import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedUser } from '@/lib/auth/types';
import {
  DocumentIcon,
  CalendarIcon,
  BellIcon,
  ChevronDownIcon,
  SettingsIcon,
} from '@/components/icons';

// Two-tier header matching the client-approved reference design (see
// docs/mvp-directors-portal-plan.md#branding): a gradient strip, an identity bar (PNG emblem +
// NICTA logo + org name), and a secondary bar with section tabs, notifications, and the signed-in
// user. Administration is linked for the Corporate Secretary/Admin since deadline management is
// now core MVP scope (#A18) — Templates and the other future-module routes still exist and are
// still role-checked, just not linked here, per the client's "hide, do not delete" instruction.
export async function AppHeader({ user, active }: { user: AuthenticatedUser; active?: string }) {
  const isSubmitter = user.roles.some((r) => r.roleCode === 'SUBMITTER');
  const isReviewer = user.roles.some(
    (r) => r.roleCode === 'REVIEWER_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN',
  );
  const isExecutive = user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER');
  const portalRoleName = user.roles.find((r) =>
    ['SUBMITTER', 'REVIEWER_SECRETARIAT', 'EXECUTIVE_VIEWER'].includes(r.roleCode),
  )?.roleName;

  const tabs: { href: string; label: string; key: string; icon: typeof DocumentIcon }[] = [];
  if (isExecutive)
    tabs.push({
      href: '/executive-dashboard',
      label: 'Dashboard',
      key: 'executive-dashboard',
      icon: DocumentIcon,
    });
  if (isSubmitter)
    tabs.push({
      href: '/submissions',
      label: 'SMC Submissions',
      key: 'submissions',
      icon: DocumentIcon,
    });
  if (isReviewer)
    tabs.push({
      href: '/review-queue',
      label: 'Review Queue',
      key: 'review-queue',
      icon: DocumentIcon,
    });
  tabs.push({
    href: '/board-papers',
    label: 'Board Papers',
    key: 'board-papers',
    icon: CalendarIcon,
  });
  if (isReviewer)
    tabs.push({ href: '/admin', label: 'Administration', key: 'admin', icon: SettingsIcon });

  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return (
    <header className="nicta-header bg-white">
      <div className="h-[5px] w-full bg-nicta-strip" />

      <div className="mx-auto flex max-w-6xl items-center justify-between border-b border-nicta-neutral-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <Image
            src="/png-emblem.png"
            alt="Papua New Guinea national emblem"
            width={40}
            height={40}
          />
          <div className="h-9 w-px bg-nicta-neutral-200" />
          <Image src="/nicta-logo.png" alt="NICTA official logo" width={44} height={32} />
          <div>
            <p className="text-xs font-medium tracking-wide text-nicta-turquoise">
              Inform | Communicate | Transform
            </p>
            <p className="text-lg text-nicta-teal-dark">
              National Information &amp; Communications Technology Authority
            </p>
          </div>
        </div>
        <div className="hidden border-l border-nicta-neutral-200 pl-4 text-right sm:block">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-nicta-neutral-700">
            Executive Reporting &amp; Board Submissions
          </p>
          <p className="font-semibold text-nicta-teal-dark">SMC &amp; Board Submissions</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
        <nav className="flex gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = active === tab.key;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                className={`flex items-center gap-2 border-b-2 py-3.5 text-sm ${
                  isActive
                    ? 'border-nicta-turquoise font-bold text-nicta-teal'
                    : 'border-transparent text-nicta-neutral-700 hover:text-nicta-teal'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/notifications"
            className="relative rounded-full p-2 text-nicta-teal-dark hover:bg-nicta-neutral-100"
            aria-label="Notifications"
          >
            <BellIcon className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-status-accent text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-nicta-teal text-sm font-semibold text-white">
              {user.name.charAt(0)}
            </span>
            <div className="text-xs leading-tight">
              <p className="text-nicta-neutral-700">Portal view</p>
              <div className="flex items-center gap-1 font-semibold text-nicta-teal-dark">
                {portalRoleName ?? 'Portal user'}
                <ChevronDownIcon className="h-3.5 w-3.5 text-nicta-neutral-700" />
              </div>
            </div>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button type="submit" className="text-xs text-nicta-teal hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
