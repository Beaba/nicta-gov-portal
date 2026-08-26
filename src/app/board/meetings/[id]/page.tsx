import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import {
  getMeetingForUser,
  listActiveBoardMembers,
  type BoardMeetingState,
} from '@/lib/board/meetings';
import { listMinutesForUser } from '@/lib/board/minutes';
import { prisma } from '@/lib/db/prisma';
import { AuthorizationError } from '@/lib/auth/rbac';
import { PortalShell } from '@/components/PortalShell';
import { CommentThread } from '@/components/CommentThread';
import {
  publishMeetingAction,
  transitionMeetingStatusAction,
  addAgendaItemAction,
  removeAgendaItemAction,
  recordAttendanceAction,
  uploadMinutesAction,
  submitMinutesForReviewAction,
  publishMinutesAction,
  createResolutionAction,
  transitionResolutionStatusAction,
  createBoardActionItemAction,
} from '@/app/board/meetings/[id]/actions';

const NEXT_STATUS: Partial<Record<BoardMeetingState, BoardMeetingState>> = {
  PUBLISHED: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
  COMPLETED: 'ARCHIVED',
};

export default async function BoardMeetingDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  let meeting;
  try {
    meeting = await getMeetingForUser(params.id, user);
  } catch (err) {
    if (err instanceof AuthorizationError) redirect('/board/meetings');
    throw err;
  }
  if (!meeting) notFound();

  const isSecretariat = user.roles.some(
    (r) => r.roleCode === 'BOARD_SECRETARIAT' || r.roleCode === 'SYSTEM_ADMIN',
  );

  const [boardPapers, boardMembers, minutes, departments, attendanceByUser] = await Promise.all([
    prisma.submission.findMany({
      where: { submissionCategory: 'BOARD', meetingId: meeting.id },
      include: { department: true },
    }),
    listActiveBoardMembers(),
    listMinutesForUser(meeting.id, user),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    Promise.resolve(new Map(meeting.attendance.map((a) => [a.userId, a.status]))),
  ]);

  const latestMinutes = minutes[0] ?? null;

  return (
    <PortalShell user={user} active="board-meetings">
      <Link href="/board/meetings" className="text-sm text-nicta-teal hover:underline">
        ← Back to Board meetings
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-nicta-neutral-700">{meeting.meetingNumber}</p>
          <h1 className="text-2xl font-medium text-nicta-teal-dark">{meeting.title}</h1>
          <p className="mt-1 text-sm text-nicta-neutral-700">
            {meeting.meetingDate.toLocaleString()}
            {meeting.venue ? ` · ${meeting.venue}` : ''}
          </p>
        </div>
        <span className="rounded-full bg-nicta-teal-light px-3 py-1 text-xs font-bold text-nicta-teal-dark">
          {meeting.status.replace(/_/g, ' ')}
        </span>
      </div>

      {isSecretariat && (
        <div className="mt-4 flex flex-wrap gap-2">
          {meeting.status === 'DRAFT' && (
            <form action={publishMeetingAction.bind(null, meeting.id)}>
              <button
                type="submit"
                className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Publish Meeting
              </button>
            </form>
          )}
          {NEXT_STATUS[meeting.status as BoardMeetingState] && (
            <form
              action={transitionMeetingStatusAction.bind(
                null,
                meeting.id,
                NEXT_STATUS[meeting.status as BoardMeetingState]!,
              )}
            >
              <button
                type="submit"
                className="rounded-md border border-nicta-neutral-200 px-4 py-2 text-sm font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-100"
              >
                Mark {NEXT_STATUS[meeting.status as BoardMeetingState]?.replace(/_/g, ' ')}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Agenda */}
      <section className="mt-8 rounded-md border border-nicta-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Agenda</h2>
        {meeting.agendaItems.length === 0 ? (
          <p className="mt-2 text-sm text-nicta-neutral-700">No agenda items yet.</p>
        ) : (
          <ol className="mt-3 space-y-2">
            {meeting.agendaItems.map((item, i) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-md border border-nicta-neutral-200 p-3"
              >
                <div>
                  <p className="text-sm font-semibold text-nicta-teal-dark">
                    {i + 1}. {item.title}
                  </p>
                  {item.description && (
                    <p className="mt-1 text-xs text-nicta-neutral-700">{item.description}</p>
                  )}
                  {item.submission && (
                    <Link
                      href={`/submissions/${item.submission.id}`}
                      className="mt-1 inline-block text-xs font-semibold text-nicta-teal hover:underline"
                    >
                      {item.submission.referenceNumber} — {item.submission.title} →
                    </Link>
                  )}
                </div>
                {isSecretariat && meeting.status === 'DRAFT' && (
                  <form action={removeAgendaItemAction.bind(null, meeting.id, item.id)}>
                    <button
                      type="submit"
                      className="text-xs font-semibold text-status-danger hover:underline"
                    >
                      Remove
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ol>
        )}

        {isSecretariat && meeting.status === 'DRAFT' && (
          <form action={addAgendaItemAction.bind(null, meeting.id)} className="mt-4 space-y-2">
            <input name="title" required placeholder="Agenda item title" className="input" />
            <textarea
              name="description"
              rows={2}
              placeholder="Description (optional)"
              className="input"
            />
            {boardPapers.length > 0 && (
              <select name="submissionId" defaultValue="" className="input">
                <option value="">Link a Board paper (optional)</option>
                {boardPapers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.referenceNumber} — {p.title}
                  </option>
                ))}
              </select>
            )}
            <button
              type="submit"
              className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Add Agenda Item
            </button>
          </form>
        )}
      </section>

      {/* Papers */}
      <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Meeting Papers</h2>
        {boardPapers.length === 0 ? (
          <p className="mt-2 text-sm text-nicta-neutral-700">No Board papers linked yet.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {boardPapers.map((p) => (
              <li key={p.id}>
                <Link href={`/submissions/${p.id}`} className="text-nicta-teal hover:underline">
                  {p.referenceNumber} — {p.title}
                </Link>
                <span className="ml-2 text-xs text-nicta-neutral-700">
                  {p.department.name} · {p.paperType}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Attendance */}
      <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Attendance and Apologies</h2>
        {isSecretariat ? (
          <form action={recordAttendanceAction.bind(null, meeting.id)} className="mt-3 space-y-2">
            {boardMembers.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span className="text-nicta-neutral-900">{m.name}</span>
                <select
                  name={`status_${m.id}`}
                  defaultValue={attendanceByUser.get(m.id) ?? 'ABSENT'}
                  className="input w-40 text-xs"
                >
                  <option value="ATTENDED">Attended</option>
                  <option value="APOLOGY">Apology</option>
                  <option value="ABSENT">Absent</option>
                </select>
              </div>
            ))}
            <button
              type="submit"
              className="mt-2 rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Save Attendance
            </button>
          </form>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {boardMembers.map((m) => (
              <li key={m.id} className="flex items-center justify-between">
                <span className="text-nicta-neutral-900">{m.name}</span>
                <span className="text-xs text-nicta-neutral-700">
                  {attendanceByUser.get(m.id) ?? 'Not recorded'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Minutes */}
      <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Minutes</h2>
        {minutes.length === 0 ? (
          <p className="mt-2 text-sm text-nicta-neutral-700">No minutes uploaded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {minutes.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-md border border-nicta-neutral-200 p-3"
              >
                <div>
                  <a
                    href={`/api/documents/local/${m.storageKey}`}
                    className="font-semibold text-nicta-teal hover:underline"
                  >
                    Version {m.version} — {m.fileName}
                  </a>
                  <p className="text-xs text-nicta-neutral-700">
                    {m.status.replace(/_/g, ' ')} · uploaded {m.uploadedAt.toLocaleDateString()}
                  </p>
                </div>
                {isSecretariat && m.status === 'DRAFT' && (
                  <form action={submitMinutesForReviewAction.bind(null, meeting.id, m.id)}>
                    <button
                      type="submit"
                      className="rounded-md border border-nicta-neutral-200 px-3 py-1.5 text-xs font-semibold hover:bg-nicta-neutral-100"
                    >
                      Submit for Review
                    </button>
                  </form>
                )}
                {isSecretariat && m.status === 'UNDER_REVIEW' && (
                  <form action={publishMinutesAction.bind(null, meeting.id, m.id)}>
                    <button
                      type="submit"
                      className="rounded-md bg-nicta-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Publish
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}

        {isSecretariat && (
          <form
            action={uploadMinutesAction.bind(null, meeting.id)}
            className="mt-4 flex items-center gap-3"
          >
            <input type="file" name="file" required className="text-sm" />
            <button
              type="submit"
              className="rounded-md bg-nicta-teal px-3 py-1.5 text-sm font-medium text-white hover:bg-nicta-teal-dark"
            >
              Upload Minutes
            </button>
          </form>
        )}

        {latestMinutes && (
          <CommentThread
            entityType="MeetingMinutes"
            entityId={latestMinutes.id}
            redirectPath={`/board/meetings/${meeting.id}`}
            actingUser={user}
          />
        )}
      </section>

      {/* Resolutions */}
      <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Resolutions</h2>
        {meeting.resolutions.length === 0 ? (
          <p className="mt-2 text-sm text-nicta-neutral-700">No resolutions recorded yet.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {meeting.resolutions.map((r) => (
              <li key={r.id} className="rounded-md border border-nicta-neutral-200 p-3">
                <div className="flex items-center justify-between">
                  <Link
                    href={`/board/resolutions/${r.id}`}
                    className="font-semibold text-nicta-teal-dark hover:underline"
                  >
                    {r.resolutionNumber} — {r.subject}
                  </Link>
                  <span className="rounded-full bg-nicta-teal-light px-2.5 py-1 text-[11px] font-bold text-nicta-teal-dark">
                    {r.status}
                  </span>
                </div>
                {isSecretariat && (
                  <ResolutionQuickActions
                    meetingId={meeting.id}
                    resolutionId={r.id}
                    status={r.status}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {isSecretariat && (
          <form action={createResolutionAction.bind(null, meeting.id)} className="mt-4 space-y-2">
            {meeting.agendaItems.length > 0 && (
              <select name="agendaItemId" defaultValue="" className="input">
                <option value="">From agenda item (optional)</option>
                {meeting.agendaItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
            )}
            <input name="subject" required placeholder="Subject" className="input" />
            <textarea
              name="resolutionText"
              required
              rows={2}
              placeholder="Resolution wording"
              className="input"
            />
            <div className="grid grid-cols-2 gap-2">
              <select name="responsibleDepartmentId" defaultValue="" className="input">
                <option value="">Responsible department (optional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input name="dueDate" type="date" className="input" />
            </div>
            <button
              type="submit"
              className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Create Resolution
            </button>
          </form>
        )}
      </section>

      {/* Action items */}
      <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Board Actions</h2>
        {meeting.actionItems.length === 0 ? (
          <p className="mt-2 text-sm text-nicta-neutral-700">
            No Board actions from this meeting yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {meeting.actionItems.map((a) => (
              <li key={a.id} className="flex items-center justify-between">
                <span className="text-nicta-neutral-900">{a.description}</span>
                <span className="text-xs text-nicta-neutral-700">
                  {a.status.replace(/_/g, ' ')}
                  {a.dueDate ? ` · due ${a.dueDate.toLocaleDateString()}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}

        {isSecretariat && (
          <form
            action={createBoardActionItemAction.bind(null, meeting.id)}
            className="mt-4 space-y-2"
          >
            <input name="description" required placeholder="Action description" className="input" />
            <div className="grid grid-cols-2 gap-2">
              <select name="departmentId" defaultValue="" className="input">
                <option value="">Responsible department (optional)</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <input name="dueDate" type="date" className="input" />
            </div>
            <button
              type="submit"
              className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Add Action
            </button>
          </form>
        )}
      </section>
    </PortalShell>
  );
}

function ResolutionQuickActions({
  meetingId,
  resolutionId,
  status,
}: {
  meetingId: string;
  resolutionId: string;
  status: string;
}) {
  const next: Record<string, string> = {
    DRAFT: 'PROPOSED',
    PROPOSED: 'APPROVED',
    APPROVED: 'IN_PROGRESS',
    IN_PROGRESS: 'COMPLETED',
    COMPLETED: 'CLOSED',
  };
  const nextStatus = next[status];
  if (!nextStatus) return null;
  return (
    <form
      action={transitionResolutionStatusAction.bind(
        null,
        meetingId,
        resolutionId,
        nextStatus as never,
      )}
      className="mt-2"
    >
      <button type="submit" className="text-xs font-semibold text-nicta-teal hover:underline">
        Move to {nextStatus} →
      </button>
    </form>
  );
}
