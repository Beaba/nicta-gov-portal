import { prisma } from '@/lib/db/prisma';
import { requireAnyRole } from '@/lib/auth/rbac';
import { BOARD_MEMBER_ROLES } from '@/lib/board/roles';
import { isDecisionPaper } from '@/lib/config/paperTypes';
import type { AuthenticatedUser } from '@/lib/auth/types';
import type { MeetingStatus } from '@prisma/client';

const VISIBLE_STATUSES: MeetingStatus[] = ['PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

export interface BoardMemberDashboardData {
  nextMeeting: Awaited<ReturnType<typeof loadNextMeeting>>;
  papersAwaitingReview: number;
  decisionsPending: number;
  unresolvedComments: number;
  openResolutions: number;
  outstandingActions: number;
  recentMinutes: Awaited<ReturnType<typeof loadRecentMinutes>>;
}

async function loadNextMeeting() {
  return prisma.meeting.findFirst({
    where: { meetingType: 'BOARD', status: { in: ['PUBLISHED', 'IN_PROGRESS'] } },
    orderBy: { meetingDate: 'asc' },
  });
}

async function loadRecentMinutes() {
  return prisma.meetingMinutes.findMany({
    where: { status: 'PUBLISHED' },
    include: { meeting: true },
    orderBy: { publishedAt: 'desc' },
    take: 5,
  });
}

/**
 * Aggregates the client's exact dashboard tile list. "Unread comments" is simplified to
 * "unresolved comments on visible papers" — there is no per-user comment-read-tracking model in
 * this MVP (would need a ReadReceipt-style table per user per comment, out of scope here — see
 * docs/known-limitations.md), so "unresolved" is the closest honest proxy: it still surfaces
 * comments that need attention, just not specifically ones *this* Board Member hasn't opened yet.
 */
export async function loadBoardMemberDashboard(
  actingUser: AuthenticatedUser,
): Promise<BoardMemberDashboardData> {
  requireAnyRole(actingUser, BOARD_MEMBER_ROLES);

  const boardPapers = await prisma.submission.findMany({
    where: { submissionCategory: 'BOARD', meeting: { status: { in: VISIBLE_STATUSES } } },
    select: { id: true, paperType: true, boardOutcome: true },
  });
  const paperIds = boardPapers.map((p) => p.id);

  const decisionPapers = boardPapers.filter((p) => isDecisionPaper(p.paperType) && !p.boardOutcome);
  const myDecisions = decisionPapers.length
    ? await prisma.decision.findMany({
        where: {
          submissionId: { in: decisionPapers.map((p) => p.id) },
          recordedById: actingUser.id,
        },
        select: { submissionId: true },
      })
    : [];
  const decidedIds = new Set(myDecisions.map((d) => d.submissionId));
  const decisionsPending = decisionPapers.filter((p) => !decidedIds.has(p.id)).length;

  const [unresolvedComments, openResolutions, outstandingActions, nextMeeting, recentMinutes] =
    await Promise.all([
      paperIds.length
        ? prisma.comment.count({
            where: { entityType: 'Submission', entityId: { in: paperIds }, isResolved: false },
          })
        : 0,
      prisma.resolution.count({
        where: { status: { notIn: ['CLOSED', 'REJECTED'] } },
      }),
      prisma.actionItem.count({
        where: { sourceMeetingId: { not: null }, status: { notIn: ['CLOSED', 'COMPLETED'] } },
      }),
      loadNextMeeting(),
      loadRecentMinutes(),
    ]);

  return {
    nextMeeting,
    papersAwaitingReview: paperIds.length,
    decisionsPending,
    unresolvedComments,
    openResolutions,
    outstandingActions,
    recentMinutes,
  };
}
