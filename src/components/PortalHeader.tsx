import Image from 'next/image';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { BellIcon, ChevronDownIcon } from '@/components/icons';

// White top bar shared by every authenticated dashboard, per the client's approved reference —
// same crest/divider/logo composition as LoginOfficialHeader (see its own comment on why two real
// PNGs are used rather than one combined file), plus the signed-in user's identity on the right.
// Sign-out lives in PortalSidebar now, not here, matching the reference.
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

  return (
    <header className="relative z-10 flex h-[84px] shrink-0 items-center justify-between border-b border-nicta-neutral-200 bg-white px-6">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-nicta-strip" />
      <div className="flex items-center gap-4">
        <Image
          src="/png-emblem.png"
          alt="Papua New Guinea national crest"
          width={48}
          height={48}
          className="h-11 w-11 object-contain"
        />
        <div className="h-9 w-px bg-nicta-neutral-200" />
        <Image
          src="/nicta-logo.png"
          alt="NICTA — National Information & Communications Technology Authority"
          width={56}
          height={40}
          className="h-8 w-auto object-contain"
        />
        <div className="hidden sm:block">
          <p className="text-sm font-semibold leading-tight text-nicta-teal-dark">
            National Information &amp; Communications Technology Authority
          </p>
          <p className="text-xs font-medium tracking-wide text-nicta-turquoise">
            Inform | Communicate | Transform
          </p>
        </div>
      </div>

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
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-nicta-teal-dark text-sm font-semibold text-white">
            {user.name.charAt(0)}
          </span>
          <div className="text-xs leading-tight">
            <p className="font-semibold text-nicta-teal-dark">{user.name}</p>
            <p className="text-nicta-neutral-700">{portalRoleName ?? 'Portal user'}</p>
          </div>
          <ChevronDownIcon className="h-3.5 w-3.5 text-nicta-neutral-700" />
        </div>
      </div>
    </header>
  );
}
