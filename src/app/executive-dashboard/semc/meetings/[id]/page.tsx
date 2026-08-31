import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getSemcMeetingForUser } from '@/lib/semc/meetings';
import { SEMC_OUTCOMES } from '@/lib/semc/outcomes';
import { SEMC_SECRETARIAT_ROLES, SEMC_CHAIR_ROLES } from '@/lib/semc/roles';
import { PortalShell } from '@/components/PortalShell';
import { EmptyState } from '@/components/EmptyState';
import {
  publishSemcMeetingAction,
  recordSemcOutcomeAction,
  addChairpersonCommentAction,
  uploadSemcMinutesAction,
  submitSemcMinutesForCeoReviewAction,
  confirmSemcMinutesAction,
  returnSemcMinutesAction,
} from '@/app/executive-dashboard/semc/meetings/[id]/actions';
import { recommendBoardEscalationAction } from '@/app/executive-dashboard/semc/actions';

export default async function SemcMeetingDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const meeting = await getSemcMeetingForUser(params.id, user);
  if (!meeting) notFound();

  const isSecretariat = user.roles.some((r) => (SEMC_SECRETARIAT_ROLES as readonly string[]).includes(r.roleCode));
  const isChair = user.roles.some((r) => (SEMC_CHAIR_ROLES as readonly string[]).includes(r.roleCode));
  const latestMinutes = meeting.minutes[0];

  return (
    <PortalShell user={user} active="semc-deliberations">
      <p className="text-sm text-nicta-neutral-700">{meeting.meetingNumber}</p>
      <h1 className="text-2xl font-semibold text-nicta-teal-dark">{meeting.title}</h1>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        {meeting.meetingDate.toLocaleDateString()} · Status: {meeting.status}
      </p>

      {isSecretariat && meeting.status === 'DRAFT' && (
        <form action={publishSemcMeetingAction.bind(null, meeting.id)} className="mt-4">
          <button type="submit" className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Publish Meeting
          </button>
        </form>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-nicta-teal-dark">Agenda</h2>
        {meeting.agendaItems.length === 0 ? (
          <EmptyState title="No agenda items yet." />
        ) : (
          <ol className="mt-3 space-y-3">
            {meeting.agendaItems.map((item) => (
              <li key={item.id} className="rounded-lg border border-nicta-neutral-200 bg-white p-4">
                <p className="font-semibold text-nicta-teal-dark">
                  {item.order + 1}. {item.title}
                </p>
                {item.submission && (
                  <p className="mt-1 text-xs text-nicta-neutral-700">
                    {item.submission.referenceNumber} — {item.submission.department.name}
                  </p>
                )}

                {isSecretariat && item.submissionId && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-semibold text-nicta-teal">Record SEMC Outcome</summary>
                    <form action={recordSemcOutcomeAction.bind(null, meeting.id)} className="mt-2 space-y-2">
                      <input type="hidden" name="submissionId" value={item.submissionId} />
                      <input type="hidden" name="agendaItemId" value={item.id} />
                      <select name="outcome" required className="input text-xs" defaultValue="">
                        <option value="" disabled>
                          Select outcome
                        </option>
                        {SEMC_OUTCOMES.map((o) => (
                          <option key={o} value={o}>
                            {o.replace(/([A-Z])/g, ' $1').trim()}
                          </option>
                        ))}
                      </select>
                      <textarea name="decisionWording" required rows={2} placeholder="Decision wording" className="input text-xs" />
                      <textarea name="semcComments" rows={2} placeholder="SEMC comments (optional)" className="input text-xs" />
                      <input type="date" name="dueDate" className="input text-xs" />
                      <button type="submit" className="rounded bg-nicta-teal-dark px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                        Record Outcome
                      </button>
                    </form>
                  </details>
                )}

                {isSecretariat && item.submissionId && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-nicta-teal">Recommend Board Escalation</summary>
                    <form action={recommendBoardEscalationAction.bind(null, item.submissionId)} className="mt-2 space-y-2">
                      <textarea name="reason" required rows={2} placeholder="Why should this escalate to the Board?" className="input text-xs" />
                      <button type="submit" className="rounded bg-nicta-teal-dark px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                        Recommend
                      </button>
                    </form>
                  </details>
                )}

                {isChair && item.submissionId && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-nicta-teal">Add Chairperson Comment</summary>
                    <form action={addChairpersonCommentAction.bind(null, meeting.id)} className="mt-2 space-y-2">
                      <input type="hidden" name="submissionId" value={item.submissionId} />
                      <textarea name="body" required rows={2} className="input text-xs" placeholder="Final Chairperson comment" />
                      <button type="submit" className="rounded bg-nicta-teal-dark px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                        Add Comment
                      </button>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-nicta-teal-dark">Minutes and Chairperson Comments</h2>

        {isSecretariat && (
          <form action={uploadSemcMinutesAction.bind(null, meeting.id)} className="mt-3 flex items-center gap-2">
            <input type="file" name="file" required className="text-xs" />
            <button type="submit" className="rounded bg-nicta-charcoal px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
              Upload Draft Minutes
            </button>
          </form>
        )}

        {latestMinutes ? (
          <div className="mt-3 rounded-lg border border-nicta-neutral-200 bg-white p-4">
            <p className="text-sm font-medium text-nicta-teal-dark">
              v{latestMinutes.version} — {latestMinutes.status.replace(/_/g, ' ')}
            </p>
            <p className="text-xs text-nicta-neutral-700">{latestMinutes.fileName}</p>

            <div className="mt-2 flex flex-wrap gap-2">
              {isSecretariat && latestMinutes.status === 'DRAFT' && (
                <form action={submitSemcMinutesForCeoReviewAction.bind(null, meeting.id, latestMinutes.id)}>
                  <button type="submit" className="rounded border border-nicta-neutral-200 px-3 py-1.5 text-xs font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-100">
                    Submit for CEO Review
                  </button>
                </form>
              )}
              {isChair && latestMinutes.status === 'UNDER_REVIEW' && (
                <>
                  <form action={confirmSemcMinutesAction.bind(null, meeting.id, latestMinutes.id)}>
                    <button type="submit" className="rounded bg-status-success px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">
                      Confirm the Record
                    </button>
                  </form>
                  <details>
                    <summary className="cursor-pointer rounded border border-status-danger px-3 py-1.5 text-xs font-semibold text-status-danger">
                      Return for Correction
                    </summary>
                    <form action={returnSemcMinutesAction.bind(null, meeting.id, latestMinutes.id)} className="mt-2 flex gap-2">
                      <input name="comment" required placeholder="Reason" className="input text-xs" />
                      <button type="submit" className="rounded bg-status-danger px-3 py-1.5 text-xs font-semibold text-white">
                        Send
                      </button>
                    </form>
                  </details>
                </>
              )}
            </div>
          </div>
        ) : (
          <EmptyState title="No minutes uploaded yet." />
        )}
      </section>
    </PortalShell>
  );
}
