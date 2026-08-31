import { getEnv } from '@/lib/config/env';
import type { CalendarProvider, CalendarEventInput, TeamsMeetingResult } from '@/lib/providers/calendar/interface';
import { LiveCalendarUnavailableError } from '@/lib/providers/calendar/interface';

/** Real Outlook/Teams integration via Microsoft Graph — reuses the same GRAPH_CLIENT_ID/
 * GRAPH_CLIENT_SECRET/GRAPH_TENANT_ID credentials already defined for SharePoint (env.ts), since
 * this is the same Graph app registration surface. Not implemented against a live tenant in this
 * environment — throws a clear configuration error rather than silently falling back to mock
 * behaviour, matching every other `graph`-mode provider in this codebase. */
export class GraphCalendarProvider implements CalendarProvider {
  readonly providerName = 'graph' as const;
  readonly supportsLiveTeamsMeetings = true;

  async createTeamsMeeting(_input: CalendarEventInput): Promise<TeamsMeetingResult> {
    const env = getEnv();
    if (!env.GRAPH_CLIENT_ID || !env.GRAPH_CLIENT_SECRET || !env.GRAPH_TENANT_ID) {
      throw new LiveCalendarUnavailableError();
    }
    throw new Error(
      'GraphCalendarProvider.createTeamsMeeting is not implemented — wire it to POST /me/onlineMeetings once a live tenant is available.',
    );
  }

  async syncAttendeeInvite(_appointmentId: string, _attendeeEmails: string[]): Promise<void> {
    const env = getEnv();
    if (!env.GRAPH_CLIENT_ID || !env.GRAPH_CLIENT_SECRET || !env.GRAPH_TENANT_ID) {
      throw new LiveCalendarUnavailableError();
    }
    throw new Error('GraphCalendarProvider.syncAttendeeInvite is not implemented.');
  }
}
