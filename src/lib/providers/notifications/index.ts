import { getEnv } from '@/lib/config/env';
import { MockNotificationProvider } from '@/lib/providers/notifications/mockProvider';
import { GraphNotificationProvider } from '@/lib/providers/notifications/graphProvider';
import type { NotificationProvider } from '@/lib/providers/notifications/interface';

let provider: NotificationProvider | undefined;

export function getNotificationProvider(): NotificationProvider {
  if (provider) return provider;
  const env = getEnv();
  provider =
    env.NOTIFICATION_PROVIDER === 'graph'
      ? new GraphNotificationProvider()
      : new MockNotificationProvider();
  return provider;
}

export type {
  NotificationProvider,
  NotificationInput,
} from '@/lib/providers/notifications/interface';
