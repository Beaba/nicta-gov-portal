import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listBoardActionItems, BOARD_ACTION_STATUSES } from '@/lib/board/actionItems';
import { PortalShell } from '@/components/PortalShell';
import { updateBoardActionAction } from '@/app/board/actions/actions';

const STATUS_TONES: Record<string, string> = {
  NOT_STARTED: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  IN_PROGRESS: 'bg-status-warning-bg text-status-warning',
  AT_RISK: 'bg-status-danger-bg text-status-danger',
  OVERDUE: 'bg-status-danger-bg text-status-danger',
  COMPLETED: 'bg-status-success-bg text-status-success',
  CLOSED: 'bg-nicta-neutral-100 text-nicta-neutral-700',
};

export default async function BoardActionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isBoard = user.roles.some(
    (r) =>
      r.roleCode === 'BOARD_MEMBER' ||
      r.roleCode === 'BOARD_SECRETARIAT' ||
      r.roleCode === 'SYSTEM_ADMIN',
  );
  if (!isBoard) redirect('/');

  const actions = await listBoardActionItems(user);

  return (
    <PortalShell user={user} active="board-actions">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Board Action Tracker</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Outstanding actions arising from Board meetings and resolutions.
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      <section className="mt-6 space-y-4">
        {actions.length === 0 ? (
          <p className="rounded-xl bg-white p-5 text-sm text-nicta-neutral-700 shadow-sm">
            No Board actions recorded yet.
          </p>
        ) : (
          actions.map((a) => {
            const isOwner = a.ownerId === user.id;
            return (
              <div key={a.id} className="rounded-xl bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-nicta-teal-dark">{a.description}</p>
                    <p className="mt-1 text-xs text-nicta-neutral-700">
                      {a.department?.name ?? 'No department'} · {a.sourceMeeting?.title ?? '—'}
                      {a.dueDate ? ` · due ${a.dueDate.toLocaleDateString()}` : ''}
                    </p>
                    {a.progressUpdate && (
                      <p className="mt-2 text-sm text-nicta-neutral-700">{a.progressUpdate}</p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONES[a.status] ?? 'bg-nicta-neutral-100 text-nicta-neutral-700'}`}
                  >
                    {a.status.replace(/_/g, ' ')}
                  </span>
                </div>

                {isOwner && !['COMPLETED', 'CLOSED'].includes(a.status) && (
                  <form
                    action={updateBoardActionAction.bind(null, a.id)}
                    className="mt-4 space-y-2 border-t border-nicta-neutral-200 pt-4"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <select name="status" defaultValue={a.status} className="input text-sm">
                        {BOARD_ACTION_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                    <textarea
                      name="progressUpdate"
                      rows={2}
                      placeholder="Progress update"
                      className="input text-sm"
                    />
                    <button
                      type="submit"
                      className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                    >
                      Save Update
                    </button>
                  </form>
                )}
              </div>
            );
          })
        )}
      </section>
    </PortalShell>
  );
}
