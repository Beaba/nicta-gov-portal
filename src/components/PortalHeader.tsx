import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { BellIcon, ChevronDownIcon, MenuIcon } from '@/components/icons';

// Shared authenticated header. The CEO view uses the cleaner single-logo treatment from the
// approved executive-dashboard mockup; other role workspaces retain the crest + NICTA lockup.
export async function PortalHeader({ user }: { user: AuthenticatedUser }) {
  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });
  const portalRoleName = user.roles.find((r) =>
    [
      'SUBMITTER',
      'REVIEWER_SECRETARIAT',
      'EXECUTIVE_VIEWER',
      'BOARD_MEMBER',
      'SYSTEM_ADMIN',
    ].includes(r.roleCode),
  )?.roleName;
  const isExecutive = user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER');
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <header className="relative z-10 flex h-[84px] shrink-0 items-center justify-between border-b border-nicta-neutral-200 bg-white px-6">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-nicta-strip" />
      <div className="flex items-center gap-3">
        <label
          htmlFor="mobile-nav-toggle"
          className="flex cursor-pointer items-center justify-center rounded-full p-2 text-nicta-teal-dark hover:bg-nicta-neutral-100 lg:hidden"
          aria-label="Open menu"
        >
          <MenuIcon className="h-5 w-5" />
        </label>
        {!isExecutive && (
          <>
            <Image
              src="/png-emblem.png"
              alt="Papua New Guinea national crest"
              width={48}
              height={48}
              className="h-11 w-11 object-contain"
            />
            <div className="h-9 w-px bg-nicta-neutral-200" />
          </>
        )}
        <Image
          src="/nicta-logo.png"
          alt="NICTA"
          width={isExecutive ? 112 : 56}
          height={isExecutive ? 64 : 40}
          className={isExecutive ? 'h-14 w-auto object-contain' : 'h-8 w-auto object-contain'}
          priority
        />
        <div className="hidden sm:block">
          <p className="max-w-md text-sm font-semibold leading-tight text-nicta-teal-dark">
            National Information &amp; Communications Technology Authority
          </p>
          <p className="mt-1 text-xs font-medium tracking-wide text-nicta-turquoise">
            Inform&nbsp; | &nbsp;Communicate&nbsp; | &nbsp;Transform
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link
          href="/notifications"
          className="relative rounded-full p-2 text-nicta-teal-dark transition-colors hover:bg-nicta-neutral-100"
          aria-label="Notifications"
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-status-accent px-1 text-[10px] font-bold text-white">
              {unreadCount}
            </span>
          )}
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-nicta-teal-dark text-sm font-semibold text-white">
            {initials}
          </span>
          <div className="hidden text-xs leading-tight sm:block">
            <p className="font-semibold text-nicta-teal-dark">{user.name}</p>
            <p className="mt-0.5 text-nicta-neutral-700">{portalRoleName ?? 'Portal user'}</p>
          </div>
          <ChevronDownIcon className="hidden h-3.5 w-3.5 text-nicta-neutral-700 sm:block" />
        </div>
      </div>
    </header>
  );
}
