import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { loadBoardMemberDashboard } from '@/lib/board/dashboard';
import { listMeetingsForUser } from '@/lib/board/meetings';
import { prisma } from '@/lib/db/prisma';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import {
  CalendarIcon,
  PaperPlaneIcon,
  ShieldCheckIcon,
  ChartIcon,
  DocumentIcon,
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

async function BoardMemberDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const data = await loadBoardMemberDashboard(user);

  return (
    <PortalShell user={user} active="board-dashboard">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Board Dashboard</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">Your Board governance workspace</p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <section className="mt-6 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-nicta-teal-dark">Upcoming Meeting</h2>
        {data.nextMeeting ? (
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-nicta-teal-dark">{data.nextMeeting.title}</p>
              <p className="mt-1 text-sm text-nicta-neutral-700">
                {data.nextMeeting.meetingDate.toLocaleString()}
                {data.nextMeeting.venue ? ` · ${data.nextMeeting.venue}` : ''}
              </p>
            </div>
            <Link
              href={`/board/meetings/${data.nextMeeting.id}`}
              className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              View meeting
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm text-nicta-neutral-700">
            No upcoming Board meeting published.
          </p>
        )}
      </section>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          label="Unresolved Comments"
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
          icon={CalendarIcon}
        />
      </div>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        <h2 className="p-5 pb-3 font-semibold text-nicta-teal-dark">Recent Activity — Minutes</h2>
        {data.recentMinutes.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-nicta-neutral-700">No published minutes yet.</p>
        ) : (
          <ul>
            {data.recentMinutes.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between border-b border-nicta-neutral-200 px-5 py-3 last:border-0"
              >
                <div>
                  <p className="font-semibold text-nicta-teal-dark">{m.meeting.title}</p>
                  <p className="text-xs text-nicta-neutral-700">
                    Published {m.publishedAt?.toLocaleDateString() ?? '—'}
                  </p>
                </div>
                <Link
                  href={`/board/meetings/${m.meetingId}`}
                  className="text-sm font-semibold text-nicta-teal hover:underline"
                >
                  View →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
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
