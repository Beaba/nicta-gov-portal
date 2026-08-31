// #A32 — Calendar/meeting provider interface (Outlook + Teams), same provider-interface pattern
// as every other Microsoft 365 touchpoint in this codebase (auth/documentStorage/notifications —
// see docs/assumptions-and-decisions.md#A3/#A7/#A13). Unlike NotificationProvider (which always
// writes an in-app record before attempting real delivery), scheduling itself is a real, useful
// local capability — the mock provider genuinely creates/updates/cancels Appointment rows; only
// `createTeamsMeeting`, which needs a live Graph-connected Teams tenant, is the piece that throws
// without credentials (mirroring the honesty precedent set by the signature provider for the one
// capability that can't be meaningfully faked).

export interface CalendarEventInput {
  title: string;
  agenda?: string;
  startAt: Date;
  endAt: Date;
  attendeeEmails: string[];
}

export interface TeamsMeetingResult {
  teamsMeetingUrl: string;
}

export interface CalendarProvider {
  readonly providerName: 'mock' | 'graph';
  readonly supportsLiveTeamsMeetings: boolean;
  /** Creates a live Teams meeting and returns its join URL. Throws if the provider cannot reach a
   * real tenant (the mock provider always throws — see mockProvider.ts). */
  createTeamsMeeting(input: CalendarEventInput): Promise<TeamsMeetingResult>;
  /** Sends a calendar invite update to attendees for a reschedule/cancel. No-op locally beyond
   * whatever the caller already does via NotificationProvider. */
  syncAttendeeInvite(appointmentId: string, attendeeEmails: string[]): Promise<void>;
}

export class LiveCalendarUnavailableError extends Error {
  constructor() {
    super('Live Outlook/Teams scheduling is not available — configure CALENDAR_PROVIDER=graph with Graph credentials.');
    this.name = 'LiveCalendarUnavailableError';
  }
}
