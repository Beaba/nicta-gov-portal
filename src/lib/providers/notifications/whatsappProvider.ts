import { prisma } from '@/lib/db/prisma';
import type {
  NotificationProvider,
  NotificationInput,
} from '@/lib/providers/notifications/interface';
import { getEnv } from '@/lib/config/env';

// #A31 — future channel, mirrors GraphNotificationProvider's exact shape: the in-app record is
// always written first (so the bell-icon inbox never depends on WhatsApp actually being
// configured), then this throws. Per the client's explicit instructions, this must never be
// "faked working" — real WhatsApp delivery additionally requires verified phone-to-user mapping,
// approved message templates, and (for anything beyond a plain notification) an expiring approval
// token with its own confirmation step — none of which exist yet. Sensitive attachments must never
// be sent through this channel even once it is configured; only a brief + secure portal link.
export class WhatsAppNotificationProvider implements NotificationProvider {
  readonly providerName = 'whatsapp' as const;

  async notify(input: NotificationInput): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        linkUrl: input.linkUrl,
      },
    });

    const env = getEnv();
    if (!env.WHATSAPP_BUSINESS_API_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error(
        'NOTIFICATION_PROVIDER=whatsapp requires WHATSAPP_BUSINESS_API_TOKEN/WHATSAPP_PHONE_NUMBER_ID.',
      );
    }
    throw new Error(
      'WhatsAppNotificationProvider delivery is not implemented — WhatsApp is a future module, coming soon.',
    );
  }
}
