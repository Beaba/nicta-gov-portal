import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { listCeoApprovalInbox } from '@/lib/executive/approvalInbox';
import { getMemoForUser } from '@/lib/memos/memos';
import { resolveFinancialRouting, listFinancialApprovalRules } from '@/lib/finance/financialRouting';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { EmptyState } from '@/components/EmptyState';
import { InboxIcon, DocumentIcon, ChartIcon, ShieldCheckIcon, AlertTriangleIcon, EnvelopeIcon } from '@/components/icons';
import {
  approveMemoAction,
  approveMemoWithConditionsAction,
  returnMemoWithCommentsAction,
  requestMemoMoreInformationAction,
  rejectMemoAction,
  delegateMemoReviewAction,
} from '@/app/executive-dashboard/approvals/actions';

export default async function ApprovalInboxPage({
  searchParams,
}: {
  searchParams: { selected?: string; category?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN')) redirect('/');

  const [items, ceoOfficeStaff, financialRules] = await Promise.all([
    listCeoApprovalInbox(user),
    prisma.user.findMany({ where: { isActive: true, roles: { some: { role: { code: 'CEO_OFFICE' } } } } }),
    listFinancialApprovalRules(user).catch(() => []),
  ]);

  const filtered = searchParams.category ? items.filter((i) => i.category === searchParams.category) : items;

  const selectedMemo =
    searchParams.selected && searchParams.selected.startsWith('cm')
      ? null
      : searchParams.selected
        ? await getMemoForUser(searchParams.selected, user).catch(() => null)
        : null;
  const selectedRouting = selectedMemo?.financialValue
    ? await resolveFinancialRouting(Number(selectedMemo.financialValue))
    : null;

  const counts = {
    all: items.length,
    memoBau: items.filter((i) => i.category === 'MEMO_BAU').length,
    financial: items.filter((i) => i.category === 'FINANCIAL_DELEGATION').length,
    semc: items.filter((i) => i.category === 'SEMC_PAPER').length,
    board: items.filter((i) => i.category === 'BOARD_MATTER').length,
    urgent: items.filter((i) => i.urgency === 'HIGH' || i.urgency === 'CRITICAL').length,
  };

  const bind = (fn: (id: string, formData: FormData) => Promise<void>) =>
    selectedMemo ? fn.bind(null, selectedMemo.id) : undefined;

  return (
    <PortalShell user={user} active="executive-approvals" variant="executive">
      <header>
        <h1 className="text-[28px] font-semibold leading-tight text-nicta-teal-dark">CEO Approval Inbox</h1>
        <p className="mt-1 text-xs font-medium text-nicta-teal">
          Portal <span className="px-2 text-nicta-neutral-700">/</span> CEO <span className="px-2 text-nicta-neutral-700">/</span> Approvals
        </p>
      </header>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <DashboardStatCard label="All Approvals" value={counts.all} icon={InboxIcon} compact />
        <DashboardStatCard label="Memos & BAU" value={counts.memoBau} icon={DocumentIcon} compact />
        <DashboardStatCard label="Financial Delegations" value={counts.financial} icon={ChartIcon} compact />
        <DashboardStatCard label="SEMC Papers" value={counts.semc} icon={DocumentIcon} compact />
        <DashboardStatCard label="Board Matters" value={counts.board} icon={ShieldCheckIcon} compact />
        <DashboardStatCard label="Urgent" value={counts.urgent} icon={AlertTriangleIcon} tone={counts.urgent > 0 ? 'danger' : 'default'} compact />
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {[
          { key: undefined, label: 'All' },
          { key: 'MEMO_BAU', label: 'Memos & BAU' },
          { key: 'FINANCIAL_DELEGATION', label: 'Financial Delegations' },
          { key: 'SEMC_PAPER', label: 'SEMC Papers' },
          { key: 'BOARD_MATTER', label: 'Board Matters' },
        ].map((f) => (
          <a
            key={f.label}
            href={f.key ? `?category=${f.key}` : '?'}
            className={`rounded-full border px-3 py-1.5 font-medium ${
              searchParams.category === f.key
                ? 'border-nicta-teal bg-nicta-teal text-white'
                : 'border-nicta-neutral-200 bg-white text-nicta-teal-dark hover:bg-nicta-neutral-100'
            }`}
          >
            {f.label}
          </a>
        ))}
      </div>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[1.5fr_0.5fr]">
        <section className="overflow-hidden rounded-lg border border-nicta-neutral-200 bg-white shadow-[0_2px_8px_rgba(21,60,68,0.04)]">
          <div className="p-3.5">
            {filtered.length === 0 ? (
              <EmptyState title="Nothing is currently awaiting your decision." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-nicta-neutral-200 text-[10px] uppercase tracking-wide text-nicta-neutral-700">
                    <tr>
                      <th className="pb-2 font-semibold">Reference</th>
                      <th className="pb-2 font-semibold">Type</th>
                      <th className="pb-2 font-semibold">Title</th>
                      <th className="pb-2 font-semibold">From</th>
                      <th className="pb-2 font-semibold">Department</th>
                      <th className="pb-2 font-semibold">Amount</th>
                      <th className="pb-2 font-semibold">Urgency</th>
                      <th className="pb-2 font-semibold">Due</th>
                      <th className="pb-2 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nicta-neutral-200">
                    {filtered.map((item) => (
                      <tr key={`${item.category}-${item.id}`} className={item.id === searchParams.selected ? 'bg-nicta-teal-light/60' : undefined}>
                        <td className="whitespace-nowrap py-2 pr-3 font-semibold text-nicta-teal">{item.referenceNumber}</td>
                        <td className="py-2 pr-3 text-nicta-neutral-700">{item.documentType}</td>
                        <td className="max-w-[200px] truncate py-2 pr-3 text-nicta-neutral-900">{item.title}</td>
                        <td className="py-2 pr-3 text-nicta-neutral-700">{item.submittedByName}</td>
                        <td className="py-2 pr-3 text-nicta-neutral-700">{item.originatingDepartment}</td>
                        <td className="py-2 pr-3 text-nicta-neutral-700">{item.amount ? `K${item.amount.toLocaleString()}` : '—'}</td>
                        <td className="py-2 pr-3">
                          <UrgencyPill value={item.urgency} />
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-nicta-neutral-700">
                          {item.dueDate ? item.dueDate.toLocaleDateString() : '—'}
                        </td>
                        <td className="py-2 text-right">
                          <a
                            href={item.category === 'BOARD_MATTER' ? item.linkUrl : `/executive-dashboard/approvals?selected=${item.id}`}
                            className="inline-flex rounded border border-nicta-teal px-2.5 py-1 text-[10px] font-semibold text-nicta-teal hover:bg-nicta-teal hover:text-white"
                          >
                            Review
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="border-t border-nicta-neutral-200 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-nicta-neutral-700">Approval Routing Rules</p>
            <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-nicta-neutral-700">
              {financialRules.map((r) => (
                <span key={r.id} className="rounded-full border border-nicta-neutral-200 bg-nicta-neutral-50 px-3 py-1">
                  {r.label}: {(JSON.parse(r.approvalStageSequence) as string[]).join(' → ')}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border border-nicta-neutral-200 bg-white shadow-[0_2px_8px_rgba(21,60,68,0.04)]">
          <div className="border-b border-nicta-neutral-200 px-3.5 py-2.5">
            <h2 className="text-sm font-semibold text-nicta-teal-dark">Approval Review</h2>
          </div>
          <div className="p-3.5">
            {!selectedMemo ? (
              <EmptyState title="Select an item to review" description="Memo/BAU and Financial Delegation items open here. SEMC and Board items open their own review panel." />
            ) : (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-nicta-teal">{selectedMemo.referenceNumber}</p>
                <p className="mt-1 text-sm font-semibold text-nicta-teal-dark">{selectedMemo.subject}</p>
                <p className="mt-1 text-xs text-nicta-neutral-700">
                  {selectedMemo.originatingDirector.name} · {selectedMemo.department.name}
                </p>
                <p className="mt-2 text-xs text-nicta-neutral-700">{selectedMemo.purpose}</p>
                <p className="mt-1 text-xs text-nicta-neutral-700">
                  <strong>Requested decision:</strong> {selectedMemo.requestedDecision}
                </p>
                {selectedMemo.recommendation && (
                  <p className="mt-1 text-xs text-nicta-neutral-700">
                    <strong>Director recommendation:</strong> {selectedMemo.recommendation}
                  </p>
                )}
                {selectedMemo.financialValue && (
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-nicta-neutral-700">
                    <div><dt className="font-semibold">Budget code</dt><dd>{selectedMemo.budgetCode ?? '—'}</dd></div>
                    <div><dt className="font-semibold">Cost centre</dt><dd>{selectedMemo.costCentre ?? '—'}</dd></div>
                    <div><dt className="font-semibold">Current version</dt><dd>{selectedMemo.currentVersion}</dd></div>
                    <div><dt className="font-semibold">Attachments</dt><dd>{selectedMemo.evidence.length}</dd></div>
                  </dl>
                )}

                {selectedRouting?.rule ? (
                  <p className="mt-3 rounded-md bg-nicta-cream px-3 py-2 text-[11px] text-nicta-neutral-700">
                    Routing: {selectedRouting.rule.label} — {selectedRouting.rule.approvalStageSequence.join(' → ')}.
                    {selectedRouting.requiresBoardApproval && ' Financial approval above K1,000,000 must be completed in the secure portal.'}
                  </p>
                ) : selectedMemo.financialValue ? (
                  <p className="mt-3 rounded-md bg-status-warning-bg px-3 py-2 text-[11px] text-status-warning">
                    No active routing rule covers this amount — escalating to portal-only review.
                  </p>
                ) : null}

                {selectedMemo.status === 'AWAITING_CEO_APPROVAL' ? (
                  <div className="mt-3 space-y-2">
                    <form action={bind(approveMemoAction)}>
                      <textarea name="comment" rows={1} placeholder="Optional comment" className="input text-xs" />
                      <button type="submit" className="mt-1 w-full rounded-md bg-nicta-charcoal px-3 py-2 text-xs font-semibold text-white hover:opacity-90">
                        Approve
                      </button>
                    </form>
                    <MemoDecisionForm action={bind(approveMemoWithConditionsAction)} label="Approve with Conditions" />
                    <MemoDecisionForm action={bind(returnMemoWithCommentsAction)} label="Return with Comments" />
                    <MemoDecisionForm action={bind(requestMemoMoreInformationAction)} label="Request Further Information" />
                    <MemoDecisionForm action={bind(rejectMemoAction)} label="Reject" tone="danger" />

                    {ceoOfficeStaff.length > 0 && (
                      <form action={bind(delegateMemoReviewAction)} className="rounded-md border border-nicta-neutral-200 p-2">
                        <label className="text-[11px] font-semibold text-nicta-teal-dark">Delegate Review</label>
                        <select name="delegatedReviewerId" required className="input mt-1 text-xs" defaultValue="">
                          <option value="" disabled>
                            Select CEO Office staff
                          </option>
                          {ceoOfficeStaff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-[10px] text-nicta-neutral-700">
                          Review only — delegated staff cannot approve or reject.
                        </p>
                        <button type="submit" className="mt-1 w-full rounded border border-nicta-neutral-200 px-2 py-1 text-xs font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-100">
                          Delegate
                        </button>
                      </form>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-nicta-neutral-700">
                    Status: {selectedMemo.status.replace(/_/g, ' ')} — no longer awaiting a CEO decision.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border border-nicta-neutral-200 bg-white p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-nicta-teal-dark">
            <EnvelopeIcon className="h-4 w-4" /> Phone / WhatsApp Notifications
          </h2>
          <p className="mt-2 text-xs text-nicta-neutral-700">
            WhatsApp eligible: ordinary memos and BAU items up to K50,000. Controlled commands:
            APPROVE, REJECT, COMMENT, REVIEW, MORE INFORMATION. Ambiguous replies (&ldquo;Okay&rdquo;, &ldquo;Looks
            good&rdquo;) are never treated as approval. Portal-only for financial approvals above
            K50,000, SEMC decisions, Board submissions, high-risk items, and anything requiring a
            future digital signature.
          </p>
        </section>
        <section className="rounded-lg border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">CEO Office Queue (Support Only)</h2>
          <p className="mt-2 text-xs text-nicta-neutral-700">
            The Executive Officer and PA organise this queue, check supporting documents, prepare
            summaries, set urgency, and draft comments. They cannot approve, reject, digitally
            sign, or issue CEO instructions unless a formal delegation exists — see{' '}
            <a href="/executive-dashboard/office" className="font-semibold text-nicta-teal hover:underline">
              CEO Office Queue
            </a>
            .
          </p>
        </section>
      </div>
    </PortalShell>
  );
}

function UrgencyPill({ value }: { value: string }) {
  const tone =
    value === 'CRITICAL' || value === 'HIGH'
      ? 'bg-status-danger-bg text-status-danger'
      : value === 'LOW'
        ? 'bg-status-success-bg text-status-success'
        : 'bg-status-warning-bg text-status-warning';
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{value}</span>;
}

function MemoDecisionForm({
  action,
  label,
  tone = 'neutral',
}: {
  action?: (formData: FormData) => Promise<void>;
  label: string;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <details className="rounded-md border border-nicta-neutral-200 p-2">
      <summary
        className={`cursor-pointer text-xs font-semibold ${tone === 'danger' ? 'text-status-danger' : 'text-nicta-teal-dark'}`}
      >
        {label}
      </summary>
      <form action={action} className="mt-2 space-y-1">
        <textarea name="comment" rows={2} required placeholder="Comment (required)" className="input text-xs" />
        <button type="submit" className="w-full rounded bg-nicta-teal-dark px-2 py-1 text-xs font-semibold text-white hover:opacity-90">
          Send
        </button>
      </form>
    </details>
  );
}
