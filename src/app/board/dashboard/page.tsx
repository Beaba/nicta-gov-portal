import { redirect } from 'next/navigation';
import Link from 'next/link';
import { DateTime } from 'luxon';
import { getCurrentUser } from '@/lib/auth';
import { loadBoardMemberDashboard } from '@/lib/board/dashboard';
import { listMeetingsForUser } from '@/lib/board/meetings';
import { listMyBoardApprovals } from '@/lib/board/decisions';
import { listResolutionsForUser } from '@/lib/board/resolutions';
import { listBoardActionItems } from '@/lib/board/actionItems';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import {
  CalendarIcon,
  PaperPlaneIcon,
  ShieldCheckIcon,
  ChartIcon,
  DocumentIcon,
  InboxIcon,
} from '@/components/icons';

export default async function BoardDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const isBoardMember = user.roles.some((r) => r.roleCode === 'BOARD_MEMBER');
  const isSecretariat = user.roles.some(
    (r) => r.roleCode === 'BOARD_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isBoardMember && !isSecretariat) redirect('/');

  if (isSecretariat && !isBoardMember) {
    return <SecretariatBoardDashboard />;
  }
  return <BoardMemberDashboard />;
}

// #A31: rebuilt to match the approved Board Member Dashboard mockup — a greeting, a days-to-next-
// meeting stat card alongside the original 5, an "Upcoming Board Meeting" card with Open Agenda/
// View Meeting Pack actions, an Approval Inbox preview (real Decision Papers awaiting this Board
// Member's own vote — #A31's listMyBoardApprovals), and a "Recent Resolutions & Actions" panel
// replacing the narrower "Recent Activity — Minutes" list (minutes are still reachable via the new
// top-level /board/minutes page, linked from the sidebar).
async function BoardMemberDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const [data, approvals, resolutions, actions] = await Promise.all([
    loadBoardMemberDashboard(user),
    listMyBoardApprovals(user),
    listResolutionsForUser(user),
    listBoardActionItems(user),
  ]);

  const daysToMeeting = data.nextMeeting
    ? Math.max(
        0,
        Math.ceil(
          DateTime.fromJSDate(data.nextMeeting.meetingDate).diff(DateTime.now(), 'days').as('days'),
        ),
      )
    : null;

  const hour = DateTime.now().setZone('Pacific/Port_Moresby').hour;
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user.name.split(' ')[0];

  return (
    <PortalShell user={user} active="board-dashboard">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Board Member Dashboard</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">Portal / Board</p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />
      <p className="mt-4 text-lg font-semibold text-nicta-teal-dark">
        {greeting}, {firstName}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <DashboardStatCard
          label="Next Board Meeting"
          value={daysToMeeting !== null ? `${daysToMeeting} days` : '—'}
          icon={CalendarIcon}
        />
        <DashboardStatCard
          label="Papers Awaiting Review"
          value={data.papersAwaitingReview}
          icon={PaperPlaneIcon}
        />
        <DashboardStatCard
          label="Decisions Pending"
          value={data.decisionsPending}
          icon={ShieldCheckIcon}
        />
        <DashboardStatCard
          label="Unread Comments"
          value={data.unresolvedComments}
          icon={ChartIcon}
        />
        <DashboardStatCard
          label="Open Resolutions"
          value={data.openResolutions}
          icon={DocumentIcon}
        />
        <DashboardStatCard
          label="Outstanding Actions"
          value={data.outstandingActions}
          icon={InboxIcon}
        />
      </div>

      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-nicta-teal-dark">Upcoming Board Meeting</h2>
        {data.nextMeeting ? (
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex w-16 flex-col items-center rounded-md border border-nicta-neutral-200 py-2">
                <span className="text-[10px] font-bold uppercase text-nicta-neutral-700">
                  {DateTime.fromJSDate(data.nextMeeting.meetingDate).toFormat('LLL')}
                </span>
                <span className="text-xl font-bold text-nicta-teal-dark">
                  {DateTime.fromJSDate(data.nextMeeting.meetingDate).toFormat('dd')}
                </span>
              </div>
              <div>
                <p className="font-semibold text-nicta-teal-dark">{data.nextMeeting.title}</p>
                <p className="mt-1 text-sm text-nicta-neutral-700">
                  {data.nextMeeting.meetingDate.toLocaleString()}
                  {data.nextMeeting.venue ? ` · ${data.nextMeeting.venue}` : ''}
                </p>
                <span className="mt-1 inline-block rounded-full bg-status-success-bg px-2.5 py-0.5 text-[11px] font-bold text-status-success">
                  {data.nextMeeting.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href={`/board/meetings/${data.nextMeeting.id}`}
                className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Open Agenda
              </Link>
              <Link
                href="/board-papers"
                className="rounded-md border border-nicta-neutral-200 px-4 py-2 text-sm font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-100"
              >
                View Meeting Pack
              </Link>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-nicta-neutral-700">
            No upcoming Board meeting published.
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="font-semibold text-nicta-teal-dark">Approval Inbox</h2>
            <Link
              href="/board/approvals"
              className="text-xs font-semibold text-nicta-teal hover:underline"
            >
              View all →
            </Link>
          </div>
          {approvals.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-nicta-neutral-700">
              Nothing is currently awaiting your decision.
            </p>
          ) : (
            <ul>
              {approvals.slice(0, 5).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 border-b border-nicta-neutral-200 px-5 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-nicta-teal">{p.referenceNumber}</p>
                    <p className="truncate text-sm font-semibold text-nicta-teal-dark">{p.title}</p>
                  </div>
                  <Link
                    href={`/submissions/${p.id}`}
                    className="shrink-0 text-sm font-semibold text-nicta-teal hover:underline"
                  >
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between p-5 pb-3">
            <h2 className="font-semibold text-nicta-teal-dark">Recent Resolutions &amp; Actions</h2>
            <Link
              href="/board/resolutions"
              className="text-xs font-semibold text-nicta-teal hover:underline"
            >
              View all →
            </Link>
          </div>
          {resolutions.length === 0 && actions.length === 0 ? (
            <p className="px-5 pb-6 text-sm text-nicta-neutral-700">Nothing recorded yet.</p>
          ) : (
            <ul>
              {resolutions.slice(0, 3).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 border-b border-nicta-neutral-200 px-5 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-nicta-teal">{r.resolutionNumber}</p>
                    <p className="truncate text-sm font-semibold text-nicta-teal-dark">
                      {r.subject}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-nicta-teal-light px-2.5 py-1 text-[11px] font-bold text-nicta-teal-dark">
                    {r.status}
                  </span>
                </li>
              ))}
              {actions.slice(0, 3).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 border-b border-nicta-neutral-200 px-5 py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-nicta-teal-dark">
                      {a.description}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-status-warning-bg px-2.5 py-1 text-[11px] font-bold text-status-warning">
                    {a.status.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PortalShell>
  );
}

async function SecretariatBoardDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const meetings = await listMeetingsForUser(user);
  const draftCount = meetings.filter((m) => m.status === 'DRAFT').length;
  const publishedCount = meetings.filter((m) =>
    ['PUBLISHED', 'IN_PROGRESS'].includes(m.status),
  ).length;
  const [pendingMinutes, openResolutions] = await Promise.all([
    prisma.meetingMinutes.count({ where: { status: { in: ['DRAFT', 'UNDER_REVIEW'] } } }),
    prisma.resolution.count({ where: { status: { notIn: ['CLOSED', 'REJECTED'] } } }),
  ]);

  return (
    <PortalShell user={user} active="board-dashboard">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-nicta-teal-dark">Board Secretariat Dashboard</h1>
          <p className="mt-1 text-sm text-nicta-neutral-700">
            Meeting scheduling, agendas, minutes and the Board archive
          </p>
          <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />
        </div>
        <Link
          href="/board/meetings"
          className="flex items-center gap-2 rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Manage Meetings
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard label="Draft Meetings" value={draftCount} icon={DocumentIcon} />
        <DashboardStatCard
          label="Published / In Progress"
          value={publishedCount}
          icon={CalendarIcon}
        />
        <DashboardStatCard label="Minutes Needing Action" value={pendingMinutes} icon={ChartIcon} />
        <DashboardStatCard
          label="Open Resolutions"
          value={openResolutions}
          icon={ShieldCheckIcon}
        />
      </div>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">Recent Meetings</h2>
        {meetings.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-nicta-neutral-700">No Board meetings yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Meeting</th>
                <th className="px-5 py-2 font-semibold">Date</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {meetings.slice(0, 8).map((m) => (
                <tr key={m.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal-dark">{m.title}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">
                    {m.meetingDate.toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{m.status}</td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/board/meetings/${m.id}`}
                      className="text-sm font-semibold text-nicta-teal hover:underline"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </PortalShell>
  );
}
