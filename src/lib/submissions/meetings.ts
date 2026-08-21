import { prisma } from '@/lib/db/prisma';
import type { Meeting } from '@prisma/client';

/**
 * The reference design's simplified submission flow doesn't ask the Director to pick a meeting —
 * new submissions are filed against whichever SMC meeting is "current" (the "Current meeting" pill
 * on the SMC Submissions register). Defined as the nearest not-yet-held meeting rather than an
 * admin-set flag, to avoid a schema/admin-UI addition for one field — see
 * docs/assumptions-and-decisions.md#A17.
 */
export async function getCurrentSmcMeeting(): Promise<Meeting | null> {
  return prisma.meeting.findFirst({
    where: { meetingType: 'SMC', status: { in: ['SCHEDULED', 'AGENDA_PREPARED'] } },
    orderBy: { meetingDate: 'asc' },
  });
}

/** Same "current meeting" as above, plus its Deadline row — for the "Next SMC meeting / Submissions
 * close" bar shared by all three dashboards (Director/Corporate Secretariat/CEO). A meeting can
 * exist without a Deadline yet (admin hasn't set one) — callers must handle a null `deadline`. */
export async function getCurrentSmcMeetingWithDeadline(): Promise<
  (Meeting & { deadline: { normalCloseAt: Date } | null }) | null
> {
  return prisma.meeting.findFirst({
    where: { meetingType: 'SMC', status: { in: ['SCHEDULED', 'AGENDA_PREPARED'] } },
    orderBy: { meetingDate: 'asc' },
    include: { deadline: { select: { normalCloseAt: true } } },
  });
}
