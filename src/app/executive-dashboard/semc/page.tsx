import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { listSemcReportsForCeoReview } from '@/lib/submissions/semcReview';
import { PortalShell } from '@/components/PortalShell';
import { DashboardStatCard } from '@/components/DashboardStatCard';
import { EmptyState } from '@/components/EmptyState';
import { CalendarIcon, DocumentIcon, PersonCheckIcon, CheckCircleIcon, RefreshIcon } from '@/components/icons';
import {
  acceptForSemcAgendaAction,
  returnSemcSubmissionToDirectorAction,
  requestSemcMoreInformationAction,
  addSemcPreliminaryCommentAction,
  rejectSemcSubmissionAction,
  closeSemcSubmissionAction,
} from '@/app/executive-dashboard/semc/actions';

const CEO_STATUS_LABEL: Record<string, string> = {
  AWAITING_CEO_REVIEW: 'Awaiting CEO Review',
  ACCEPTED_FOR_AGENDA: 'Accepted for Agenda',
  RETURNED: 'Returned',
  MORE_INFORMATION_REQUESTED: 'More Information Requested',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

export default async function SemcReportingPage({ searchParams }: { searchParams: { selected?: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN')) redirect('/');

  const [reports, nextMeeting] = await Promise.all([
    listSemcReportsForCeoReview(user),
    prisma.meeting.findFirst({
      where: { meetingType: 'SMC', status: { in: ['DRAFT', 'PUBLISHED'] } },
      include: { deadline: true },
      orderBy: { meetingDate: 'asc' },
    }),
  ]);

  const selected = searchParams.selected ? reports.find((r) => r.id === searchParams.selected) : undefined;
  const counts = {
    awaitingSecretariat: 0, // computed on the Secretariat side (/review-queue) — not duplicated here
    awaitingCeo: reports.filter((r) => !r.ceoAgendaStatus || r.ceoAgendaStatus === 'AWAITING_CEO_REVIEW').length,
    acceptedForAgenda: reports.filter((r) => r.ceoAgendaStatus === 'ACCEPTED_FOR_AGENDA').length,
    returned: reports.filter((r) => r.ceoAgendaStatus === 'RETURNED').length,
    late: reports.filter((r) => r.isLate).length,
  };

  const bind = (fn: (id: string, formData: FormData) => Promise<void>) =>
    selected ? fn.bind(null, selected.id) : undefined;

  return (
    <PortalShell user={user} active="semc-reports" variant="executive">
      <header>
        <h1 className="text-[28px] font-semibold leading-tight text-nicta-teal-dark">SEMC Executive Reporting</h1>
        <p className="mt-1 text-xs font-medium text-nicta-teal">
          Portal <span className="px-2 text-nicta-neutral-700">/</span> CEO{' '}
          <span className="px-2 text-nicta-neutral-700">/</span> Executive Reporting
        </p>
      </header>

      {nextMeeting && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-nicta-neutral-700">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-nicta-neutral-200 bg-white px-3 py-1.5">
            <CalendarIcon className="h-3.5 w-3.5 text-nicta-teal" />
            SEMC Meeting — {nextMeeting.meetingDate.toLocaleDateString()}
          </span>
          {nextMeeting.deadline && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-nicta-neutral-200 bg-white px-3 py-1.5">
              Reporting window: {nextMeeting.status === 'DRAFT' ? 'Open' : 'Closed'} · Submissions close{' '}
              {nextMeeting.deadline.normalCloseAt.toLocaleString()}
            </span>
          )}
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <DashboardStatCard label="Awaiting Secretariat Vetting" value={counts.awaitingSecretariat} icon={DocumentIcon} compact />
        <DashboardStatCard label="Awaiting CEO Review" value={counts.awaitingCeo} icon={PersonCheckIcon} compact />
        <DashboardStatCard label="Accepted for Agenda" value={counts.acceptedForAgenda} icon={CheckCircleIcon} compact />
        <DashboardStatCard label="Returned" value={counts.returned} icon={RefreshIcon} compact tone={counts.returned > 0 ? 'danger' : 'default'} />
        <DashboardStatCard label="Late" value={counts.late} icon={CalendarIcon} compact tone={counts.late > 0 ? 'danger' : 'default'} />
      </div>

      <div className="mt-3 grid items-start gap-3 xl:grid-cols-[1.4fr_0.6fr]">
        <section className="overflow-hidden rounded-lg border border-nicta-neutral-200 bg-white shadow-[0_2px_8px_rgba(21,60,68,0.04)]">
          <div className="border-b border-nicta-neutral-200 px-3.5 py-2.5">
            <h2 className="text-sm font-semibold text-nicta-teal-dark">SEMC Reports for CEO Review</h2>
          </div>
          <div className="p-3.5">
            {reports.length === 0 ? (
              <EmptyState title="No SEMC reports are currently awaiting your review." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="border-b border-nicta-neutral-200 text-[10px] uppercase tracking-wide text-nicta-neutral-700">
                    <tr>
                      <th className="pb-2 font-semibold">Reference</th>
                      <th className="pb-2 font-semibold">Department</th>
                      <th className="pb-2 font-semibold">Paper</th>
                      <th className="pb-2 font-semibold">CEO Status</th>
                      <th className="pb-2 font-semibold">Submitted</th>
                      <th className="pb-2 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-nicta-neutral-200">
                    {reports.map((r) => (
                      <tr key={r.id} className={r.id === selected?.id ? 'bg-nicta-teal-light/60' : undefined}>
                        <td className="whitespace-nowrap py-2 pr-3 font-semibold text-nicta-teal">{r.referenceNumber}</td>
                        <td className="py-2 pr-3 text-nicta-neutral-700">{r.department.name}</td>
                        <td className="max-w-[180px] truncate py-2 pr-3 text-nicta-neutral-900">{r.title}</td>
                        <td className="py-2 pr-3 text-nicta-neutral-700">
                          {CEO_STATUS_LABEL[r.ceoAgendaStatus ?? 'AWAITING_CEO_REVIEW']}
                        </td>
                        <td className="py-2 pr-3 text-nicta-neutral-700">
                          {r.submittedAt?.toLocaleDateString() ?? '—'}
                        </td>
                        <td className="py-2 text-right">
                          <a
                            href={`/executive-dashboard/semc?selected=${r.id}`}
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
        </section>

        <section className="overflow-hidden rounded-lg border border-nicta-neutral-200 bg-white shadow-[0_2px_8px_rgba(21,60,68,0.04)]">
          <div className="border-b border-nicta-neutral-200 px-3.5 py-2.5">
            <h2 className="text-sm font-semibold text-nicta-teal-dark">CEO Review Panel</h2>
          </div>
          <div className="p-3.5">
            {!selected ? (
              <EmptyState title="Select a report to review" description="Choose Review in the table to record your pre-meeting decision." />
            ) : (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-nicta-teal">{selected.referenceNumber}</p>
                <p className="mt-1 text-sm font-semibold text-nicta-teal-dark">{selected.title}</p>
                <p className="mt-1 text-xs text-nicta-neutral-700">{selected.department.name}</p>
                {selected.executiveSummary && (
                  <p className="mt-2 text-xs text-nicta-neutral-700">{selected.executiveSummary}</p>
                )}
                <p className="mt-2 text-[11px] text-nicta-neutral-700">
                  Version {selected.currentVersion} · Secretariat status: {selected.workflowStatus}
                </p>

                <div className="mt-3 space-y-2">
                  <form action={bind(acceptForSemcAgendaAction)}>
                    <button type="submit" className="w-full rounded-md bg-nicta-charcoal px-3 py-2 text-xs font-semibold text-white hover:opacity-90">
                      Accept for Agenda
                    </button>
                  </form>
                  <SemcCommentForm action={bind(returnSemcSubmissionToDirectorAction)} label="Return to Director" required tone="danger" />
                  <SemcCommentForm action={bind(requestSemcMoreInformationAction)} label="Request More Information" required tone="warning" />
                  <SemcCommentForm action={bind(addSemcPreliminaryCommentAction)} label="Add Preliminary Comment" required tone="neutral" />
                  <SemcCommentForm action={bind(rejectSemcSubmissionAction)} label="Reject" required tone="danger" />
                  <form action={bind(closeSemcSubmissionAction)}>
                    <button type="submit" className="w-full rounded-md border border-nicta-neutral-200 px-3 py-2 text-xs font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-100">
                      Close
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}

function SemcCommentForm({
  action,
  label,
  required,
  tone,
}: {
  action?: (formData: FormData) => Promise<void>;
  label: string;
  required: boolean;
  tone: 'danger' | 'warning' | 'neutral';
}) {
  const toneClass =
    tone === 'danger'
      ? 'border border-status-danger text-status-danger hover:bg-status-danger hover:text-white'
      : tone === 'warning'
        ? 'border border-status-warning text-status-warning hover:bg-status-warning hover:text-white'
        : 'border border-nicta-neutral-200 text-nicta-teal-dark hover:bg-nicta-neutral-100';
  return (
    <details className="rounded-md border border-nicta-neutral-200 p-2">
      <summary className={`cursor-pointer rounded px-2 py-1 text-xs font-semibold ${toneClass}`}>{label}</summary>
      <form action={action} className="mt-2 space-y-1">
        <textarea name="comment" rows={2} required={required} placeholder="Comment" className="input text-xs" />
        <button type="submit" className="w-full rounded bg-nicta-teal-dark px-2 py-1 text-xs font-semibold text-white hover:opacity-90">
          Send
        </button>
      </form>
    </details>
  );
}

