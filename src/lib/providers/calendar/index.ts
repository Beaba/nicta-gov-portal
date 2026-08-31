import { getEnv } from '@/lib/config/env';
import { MockCalendarProvider } from '@/lib/providers/calendar/mockProvider';
import { GraphCalendarProvider } from '@/lib/providers/calendar/graphProvider';
import type { CalendarProvider } from '@/lib/providers/calendar/interface';

let provider: CalendarProvider | undefined;

export function getCalendarProvider(): CalendarProvider {
  if (provider) return provider;
  const env = getEnv();
  provider = env.CALENDAR_PROVIDER === 'graph' ? new GraphCalendarProvider() : new MockCalendarProvider();
  return provider;
}

export type { CalendarProvider, CalendarEventInput, TeamsMeetingResult } from '@/lib/providers/calendar/interface';
export { LiveCalendarUnavailableError } from '@/lib/providers/calendar/interface';
