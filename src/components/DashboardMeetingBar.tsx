import { DateTime } from 'luxon';
import { CalendarIcon } from '@/components/icons';

// "Next SMC meeting / Submissions close" pill, shared by all three dashboards. Dates are formatted
// in Pacific/Port_Moresby, never the server or browser's local zone — same rule as every deadline
// comparison in this app (CLAUDE.md, docs/assumptions-and-decisions.md#A11). This is display only,
// not a deadline decision, but there's no reason to format it any other way.
export function DashboardMeetingBar({
  meetingDate,
  submissionsCloseAt,
}: {
  meetingDate: Date | null;
  submissionsCloseAt: Date | null;
}) {
  if (!meetingDate) return null;

  const format = (d: Date) =>
    DateTime.fromJSDate(d).setZone('Pacific/Port_Moresby').toFormat('d MMMM yyyy');

  return (
    <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl bg-white px-5 py-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-nicta-teal-dark text-white">
        <CalendarIcon className="h-4 w-4" />
      </span>
      <p className="text-sm text-nicta-neutral-700">
        Next SMC meeting:{' '}
        <span className="font-semibold text-nicta-teal-dark">{format(meetingDate)}</span>
      </p>
      {submissionsCloseAt && (
        <>
          <span className="hidden h-5 w-px bg-nicta-neutral-200 sm:block" />
          <p className="text-sm text-nicta-neutral-700">
            Submissions close:{' '}
            <span className="font-semibold text-nicta-teal-dark">{format(submissionsCloseAt)}</span>
          </p>
        </>
      )}
    </div>
  );
}
