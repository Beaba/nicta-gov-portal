import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getMilestoneForUser, milestoneRiskStatus } from '@/lib/performance/milestones';
import { PortalShell } from '@/components/PortalShell';
import { TrafficLight } from '@/components/TrafficLight';
import {
  submitMilestoneProgressAction,
  validateMilestoneAction,
  returnMilestoneForClarificationAction,
  changeMilestoneTargetAction,
} from '@/app/executive-dashboard/performance/milestones/[id]/actions';

export default async function MilestoneDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const milestone = await getMilestoneForUser(params.id, user);
  if (!milestone) notFound();

  const isCeo = user.roles.some((r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN');
  const isOwnDirector = milestone.responsibleDirectorId === user.id;
  const bind = (fn: (id: string, formData: FormData) => Promise<void>) => fn.bind(null, milestone.id);

  return (
    <PortalShell user={user} active="executive-performance">
      <p className="text-sm text-nicta-neutral-700">{milestone.referenceNumber}</p>
      <div className="mt-1 flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-nicta-teal-dark">{milestone.title}</h1>
        <TrafficLight status={milestoneRiskStatus(milestone)} />
      </div>
      <p className="mt-1 text-sm text-nicta-neutral-700">
        {milestone.department.name} · Responsible: {milestone.responsibleDirector.name} · Due{' '}
        {milestone.dueDate.toLocaleDateString()}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-nicta-neutral-700">Target</dt>
          <dd className="mt-1 text-nicta-neutral-900">{milestone.targetDescription}</dd>
        </div>
        <div>
          <dt className="text-nicta-neutral-700">Validation status</dt>
          <dd className="mt-1 font-semibold text-nicta-teal-dark">
            {milestone.validationStatus.replace(/_/g, ' ')}
          </dd>
        </div>
        <div>
          <dt className="text-nicta-neutral-700">Progress</dt>
          <dd className="mt-1 text-nicta-neutral-900">{milestone.progressPercent}%</dd>
        </div>
        {milestone.description && (
          <div className="col-span-2">
            <dt className="text-nicta-neutral-700">Description</dt>
            <dd className="mt-1 text-nicta-neutral-900">{milestone.description}</dd>
          </div>
        )}
        {milestone.directorComment && (
          <div className="col-span-2">
            <dt className="text-nicta-neutral-700">Director comment</dt>
            <dd className="mt-1 text-nicta-neutral-900">{milestone.directorComment}</dd>
          </div>
        )}
        {milestone.ceoComment && (
          <div className="col-span-2">
            <dt className="text-nicta-neutral-700">CEO comment</dt>
            <dd className="mt-1 text-nicta-neutral-900">{milestone.ceoComment}</dd>
          </div>
        )}
      </dl>

      {milestone.evidence.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">Evidence</h2>
          <ul className="mt-2 space-y-1">
            {milestone.evidence.map((e) => (
              <li key={e.id}>
                <a
                  href={`/api/documents/local/${e.storageKey}`}
                  className="text-sm text-nicta-teal hover:underline"
                >
                  {e.fileName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isOwnDirector && (
        <section className="mt-8 space-y-3 rounded-lg border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">Submit progress</h2>
          <form action={bind(submitMilestoneProgressAction)} className="space-y-2">
            <label className="block text-xs font-medium text-nicta-teal-dark">Progress (%)</label>
            <input
              type="number"
              name="progressPercent"
              min={0}
              max={100}
              defaultValue={milestone.progressPercent}
              required
              className="input"
            />
            <label className="block text-xs font-medium text-nicta-teal-dark">Comment</label>
            <textarea name="directorComment" rows={2} className="input" placeholder="Optional" />
            <button
              type="submit"
              className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Submit for CEO Validation
            </button>
          </form>
        </section>
      )}

      {isCeo && milestone.validationStatus === 'AWAITING_CEO_VALIDATION' && (
        <section className="mt-8 space-y-3 rounded-lg border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">CEO validation</h2>
          <form action={bind(validateMilestoneAction)} className="space-y-2">
            <textarea name="ceoComment" rows={2} className="input" placeholder="Optional comment" />
            <button
              type="submit"
              className="rounded-md bg-status-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Validate
            </button>
          </form>
          <form action={bind(returnMilestoneForClarificationAction)} className="space-y-2">
            <textarea
              name="ceoComment"
              rows={2}
              required
              className="input"
              placeholder="Required — explain what needs clarification"
            />
            <button
              type="submit"
              className="rounded-md bg-status-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Return for Clarification
            </button>
          </form>
        </section>
      )}

      {isCeo && (
        <section className="mt-8 space-y-2 rounded-lg border border-nicta-neutral-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-nicta-teal-dark">Change approved target</h2>
          <p className="text-xs text-nicta-neutral-700">
            Requires a reason — recorded with the previous value, new value, your name and a
            timestamp in the audit log.
          </p>
          <form action={bind(changeMilestoneTargetAction)} className="space-y-2">
            <textarea
              name="targetDescription"
              rows={2}
              className="input"
              placeholder="New target (leave blank to keep current)"
            />
            <input type="date" name="dueDate" className="input" />
            <textarea name="reason" required rows={2} className="input" placeholder="Required — reason for the change" />
            <button
              type="submit"
              className="rounded-md border border-nicta-neutral-200 px-4 py-2 text-sm font-semibold text-nicta-teal-dark hover:bg-nicta-neutral-100"
            >
              Change Target
            </button>
          </form>
        </section>
      )}
    </PortalShell>
  );
}
