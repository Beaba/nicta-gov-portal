import type { CalendarProvider, CalendarEventInput, TeamsMeetingResult } from '@/lib/providers/calendar/interface';
import { LiveCalendarUnavailableError } from '@/lib/providers/calendar/interface';

/** Local dev/demo provider — appointment scheduling itself (create/reschedule/cancel/invitee
 * response) is handled entirely by src/lib/appointments/appointments.ts against the database and
 * works fully without this provider. This provider is only consulted for the one capability that
 * genuinely requires a live Microsoft tenant: a real, joinable Teams meeting link. It does not
 * fabricate one. */
export class MockCalendarProvider implements CalendarProvider {
  readonly providerName = 'mock' as const;
  readonly supportsLiveTeamsMeetings = false;

  async createTeamsMeeting(_input: CalendarEventInput): Promise<TeamsMeetingResult> {
    throw new LiveCalendarUnavailableError();
  }

  async syncAttendeeInvite(_appointmentId: string, _attendeeEmails: string[]): Promise<void> {
    // No-op — attendee notification already happens via NotificationProvider at the call site.
  }
}
