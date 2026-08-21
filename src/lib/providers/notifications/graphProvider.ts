import { prisma } from '@/lib/db/prisma';
import type {
  NotificationProvider,
  NotificationInput,
} from '@/lib/providers/notifications/interface';
import { getEnv } from '@/lib/config/env';

// Production target: Outlook (Graph `/users/{id}/sendMail`) and/or a Teams channel webhook, in
// addition to the in-app record every provider writes so the bell-icon inbox always works
// regardless of delivery channel. Not implemented against a live tenant in this build — see
// docs/graph-permissions-guide.md for the Mail.Send application permission this would require.
export class GraphNotificationProvider implements NotificationProvider {
  readonly providerName = 'graph' as const;

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
    if (!env.GRAPH_CLIENT_ID) {
      throw new Error(
        'NOTIFICATION_PROVIDER=graph requires GRAPH_CLIENT_ID/GRAPH_CLIENT_SECRET/GRAPH_TENANT_ID.',
      );
    }
    throw new Error(
      'GraphNotificationProvider email/Teams delivery is not implemented against a live tenant in this build.',
    );
  }
}
