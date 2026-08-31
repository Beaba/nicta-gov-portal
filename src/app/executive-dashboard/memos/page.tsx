import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { listAllMemosForUser } from '@/lib/memos/memos';
import { MEMO_CATEGORIES } from '@/lib/memos/categories';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';
import { createMemoAction, withdrawMemoAction } from '@/app/executive-dashboard/memos/actions';

const STATUS_TONE: Record<string, string> = {
  DRAFT: 'bg-nicta-neutral-100 text-nicta-neutral-700',
  AWAITING_CEO_APPROVAL: 'bg-status-warning-bg text-status-warning',
  APPROVED: 'bg-status-success-bg text-status-success',
  APPROVED_WITH_CONDITIONS: 'bg-status-success-bg text-status-success',
  REJECTED: 'bg-status-danger-bg text-status-danger',
  RETURNED: 'bg-status-danger-bg text-status-danger',
  WITHDRAWN: 'bg-nicta-neutral-100 text-nicta-neutral-700',
};

export default async function MemosPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const isDirector = user.roles.some((r) => r.roleCode === 'SUBMITTER');
  const isCeo = user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN');
  if (!isDirector && !isCeo && !user.roles.some((r) => r.roleCode === 'CEO_OFFICE')) redirect('/');

  const [memos, departments] = await Promise.all([
    listAllMemosForUser(user),
    prisma.department.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <PortalShell user={user} active="executive-memos">
      <h1 className="text-3xl font-bold text-nicta-teal-dark">Memos &amp; BAU Approvals</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        {isCeo ? 'Every memo submitted for CEO approval.' : 'Memos you have originated.'}
      </p>
      <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />

      {isDirector && (
        <details className="mt-4">
          <summary className="cursor-pointer list-none rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            + New Memo
          </summary>
          <form action={createMemoAction} className="mt-3 max-w-xl space-y-3 rounded-lg border border-nicta-neutral-200 bg-white p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-nicta-teal-dark">Category</label>
                <select name="category" required className="input mt-1" defaultValue="">
                  <option value="" disabled>Select</option>
                  {MEMO_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-nicta-teal-dark">Priority</label>
                <select name="priority" className="input mt-1" defaultValue="MEDIUM">
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Subject</label>
              <input name="subject" required className="input mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Department</label>
              <select name="departmentId" required className="input mt-1" defaultValue={user.departmentId ?? ''}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Purpose</label>
              <textarea name="purpose" required rows={2} className="input mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Requested decision</label>
              <textarea name="requestedDecision" required rows={2} className="input mt-1" />
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Recommendation</label>
              <textarea name="recommendation" rows={2} className="input mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-nicta-teal-dark">Financial value (K)</label>
                <input type="number" name="financialValue" step="0.01" className="input mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-nicta-teal-dark">Budget code</label>
                <input name="budgetCode" className="input mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-nicta-teal-dark">Cost centre</label>
                <input name="costCentre" className="input mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-nicta-teal-dark">Due date</label>
              <input type="date" name="dueDate" className="input mt-1" />
            </div>
            <button type="submit" className="w-full rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              Submit Memo
            </button>
          </form>
        </details>
      )}

      <section className="mt-6 rounded-xl bg-white shadow-sm">
        {memos.length === 0 ? (
          <EmptyState title="No memos yet." />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="border-y border-nicta-neutral-200 bg-nicta-neutral-50 text-left text-[11px] uppercase tracking-wide text-nicta-neutral-700">
              <tr>
                <th className="px-5 py-2 font-semibold">Reference</th>
                <th className="px-5 py-2 font-semibold">Category</th>
                <th className="px-5 py-2 font-semibold">Subject</th>
                <th className="px-5 py-2 font-semibold">Department</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {memos.map((m) => (
                <tr key={m.id} className="border-b border-nicta-neutral-200 last:border-0">
                  <td className="px-5 py-3 font-semibold text-nicta-teal">{m.referenceNumber}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{m.category}</td>
                  <td className="px-5 py-3 text-nicta-neutral-900">{m.subject}</td>
                  <td className="px-5 py-3 text-nicta-neutral-700">{m.department.name}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[m.status] ?? ''}`}>
                      {m.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {isCeo ? (
                      <a href={`/executive-dashboard/approvals?selected=${m.id}`} className="text-sm font-semibold text-nicta-teal hover:underline">
                        Review
                      </a>
                    ) : m.status === 'DRAFT' ? (
                      <form action={withdrawMemoAction.bind(null, m.id)}>
                        <button type="submit" className="text-xs font-semibold text-status-danger hover:underline">
                          Withdraw
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-nicta-neutral-700">—</span>
                    )}
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
