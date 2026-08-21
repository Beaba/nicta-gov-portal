import { prisma } from '@/lib/db/prisma';
import type {
  NotificationProvider,
  NotificationInput,
} from '@/lib/providers/notifications/interface';

// Stores notifications in-app only (the Notification table backs the bell-icon inbox) — no email
// or Teams delivery, since no tenant is available in this environment. See
// docs/assumptions-and-decisions.md.
export class MockNotificationProvider implements NotificationProvider {
  readonly providerName = 'mock' as const;

  async notify(input: NotificationInput): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        linkUrl: input.linkUrl,
      },
    });
  }
}
