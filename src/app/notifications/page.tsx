import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';
import { ComingSoonBadge } from '@/components/ComingSoonBadge';
import Link from 'next/link';

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });

  return (
    <PortalShell user={user}>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-nicta-teal-dark">Notifications</h1>
        <ComingSoonBadge label="WhatsApp notifications" />
      </div>

      {notifications.length === 0 ? (
        <p className="mt-8 text-sm text-nicta-neutral-700">No notifications yet.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {notifications.map((n) => (
            <li key={n.id} className="rounded-md border border-nicta-neutral-200 bg-white p-4">
              <p className="text-sm text-nicta-teal-dark">{n.message}</p>
              <div className="mt-2 flex items-center justify-between text-xs text-nicta-neutral-700">
                <span>{n.createdAt.toLocaleString()}</span>
                {n.linkUrl && (
                  <Link href={n.linkUrl} className="font-semibold text-nicta-teal hover:underline">
                    View →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PortalShell>
  );
}
