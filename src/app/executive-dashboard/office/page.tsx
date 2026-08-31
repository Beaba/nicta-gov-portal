import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { listAllMemosForUser } from '@/lib/memos/memos';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';
import { draftMemoCommentAction, setMemoUrgencyAction } from '@/app/executive-dashboard/office/actions';

// #A32 — CEO Office (Executive Officer / PA) queue: organise, check supporting docs, set urgency,
// draft comments. No approve/reject/sign controls exist on this page at all — not merely
// hidden-by-role, genuinely absent — matching "cannot approve or reject unless a formal delegation
// exists," and this pass builds only the review-delegation half (memos.ts's delegateMemoReview
// comment explains why decision-authority delegation is out of scope for this increment).
export default async function CeoOfficePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'CEO_OFFICE' || r.roleCode === 'SYSTEM_ADMIN')) redirect('/');

  const memos = await listAllMemosForUser(user);

  return (
    <PortalShell user={user} active="ceo-office">
      <h1 className="text-2xl font-semibold text-nicta-teal-dark">CEO Office Queue</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        Items the CEO has delegated to you for review and coordination. You can organise, set
        urgency, and draft comments — approval and rejection remain the CEO&rsquo;s own actions.
      </p>

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        {memos.length === 0 ? (
          <EmptyState title="Nothing has been delegated to you for review yet." />
        ) : (
          <div className="divide-y divide-nicta-neutral-200">
            {memos.map((m) => (
              <div key={m.id} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-nicta-teal">{m.referenceNumber}</p>
                    <p className="font-semibold text-nicta-teal-dark">{m.subject}</p>
                    <p className="text-xs text-nicta-neutral-700">{m.category} · {m.department.name}</p>
                  </div>
                  <span className="rounded-full bg-nicta-teal-light px-2.5 py-1 text-[11px] font-bold text-nicta-teal-dark">
                    {m.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <form action={setMemoUrgencyAction.bind(null, m.id)} className="flex items-center gap-2">
                    <label className="text-xs text-nicta-neutral-700">Urgency</label>
                    <select name="priority" defaultValue={m.priority} className="rounded border border-nicta-neutral-200 px-2 py-1 text-xs">
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                    <button type="submit" className="text-xs font-semibold text-nicta-teal hover:underline">Set</button>
                  </form>
                </div>

                <form action={draftMemoCommentAction.bind(null, m.id)} className="mt-3 flex gap-2">
                  <input name="body" placeholder="Draft a comment for the CEO" className="flex-1 rounded border border-nicta-neutral-200 px-2 py-1 text-xs" />
                  <button type="submit" className="rounded bg-nicta-teal-dark px-3 py-1 text-xs font-semibold text-white hover:opacity-90">
                    Add
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </PortalShell>
  );
}
