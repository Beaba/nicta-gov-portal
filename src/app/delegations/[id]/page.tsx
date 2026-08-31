import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getDelegationForUser } from '@/lib/delegations/delegations';
import { prisma } from '@/lib/db/prisma';
import { AuthorizationError } from '@/lib/auth/rbac';
import { PortalShell } from '@/components/PortalShell';
import { DelegationStatusBadge } from '@/components/DelegationStatusBadge';
import {
  issueDelegationAction,
  acknowledgeDelegationAction,
  startDelegationWorkAction,
  flagDelegationRiskAction,
  clearDelegationRiskAction,
  submitDelegationForReviewAction,
  resumeDelegationWorkAction,
  returnDelegationForMoreWorkAction,
  completeDelegationAction,
  closeDelegationAction,
  cancelDelegationAction,
  extendDelegationDueDateAction,
  requestDelegationExtensionAction,
  addDelegationUpdateAction,
  addCeoCommentAction,
  nominateDelegationAlternateAction,
  assignDelegationToManagerAction,
} from '@/app/delegations/[id]/actions';

export default async function DelegationDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  let delegation;
  try {
    delegation = await getDelegationForUser(params.id, user);
  } catch (err) {
    if (err instanceof AuthorizationError) redirect('/');
    throw err;
  }
  if (!delegation) notFound();

  const managers = await prisma.user.findMany({
    where: { isActive: true, roles: { some: { role: { code: 'MANAGER' } } } },
    orderBy: { name: 'asc' },
  });

  const isCeo = user.roles.some(
    (r) => r.roleCode === 'EXECUTIVE_VIEWER' || r.roleCode === 'SYSTEM_ADMIN',
  );
  const isOwnDirector = delegation.responsibleDirectorId === user.id;

  const performerIds = Array.from(new Set(delegation.transitions.map((t) => t.performedById)));
  const performers = await prisma.user.findMany({ where: { id: { in: performerIds } } });
  const nameById = new Map(performers.map((p) => [p.id, p.name]));

  const status = delegation.status;
  const bind = (fn: (id: string, formData: FormData) => Promise<void>) =>
    fn.bind(null, delegation.id);

  return (
    <PortalShell user={user} active="delegations">
      <Link href="/delegations" className="text-sm text-nicta-teal hover:underline">
        ← Back to delegations
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-nicta-neutral-700">{delegation.referenceNumber}</p>
          <h1 className="text-2xl font-medium text-nicta-teal-dark">{delegation.title}</h1>
        </div>
        <DelegationStatusBadge delegation={delegation} />
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Field label="Responsible Director" value={delegation.responsibleDirector.name} />
        <Field label="Supporting department" value={delegation.supportingDepartment?.name ?? '—'} />
        <Field label="Priority" value={formatPriority(delegation.priority)} />
        <Field label="Confidentiality" value={delegation.confidentiality} />
        <Field label="Start date" value={delegation.startDate.toLocaleDateString()} />
        <Field label="Due date" value={delegation.dueDate.toLocaleDateString()} />
      </dl>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Description</h2>
        <p className="mt-1 text-sm text-nicta-neutral-700">{delegation.description}</p>
      </div>

      <div className="mt-4">
        <h2 className="text-sm font-semibold text-nicta-neutral-900">Expected outcome</h2>
        <p className="mt-1 text-sm text-nicta-neutral-700">{delegation.expectedOutcome}</p>
      </div>

      {delegation.requiredEvidence && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-nicta-neutral-900">Required evidence</h2>
          <p className="mt-1 text-sm text-nicta-neutral-700">{delegation.requiredEvidence}</p>
        </div>
      )}

      {delegation.closureDecision && (
        <div className="mt-6 rounded-md border border-nicta-neutral-200 bg-nicta-neutral-50 p-4">
          <p className="text-sm font-semibold text-nicta-teal-dark">Closure decision</p>
          <p className="mt-1 text-sm text-nicta-neutral-700">{delegation.closureDecision}</p>
        </div>
      )}

      {/* CEO actions */}
      {isCeo && status === 'DRAFT' && (
        <ActionSection title="Issue this delegation">
          <form action={bind(issueDelegationAction)}>
            <SubmitButton tone="primary">Issue to Director</SubmitButton>
          </form>
        </ActionSection>
      )}

      {isCeo && status === 'SUBMITTED_FOR_REVIEW' && (
        <ActionSection title="Review submitted work">
          <CommentForm
            action={bind(completeDelegationAction)}
            label="Mark Completed"
            tone="success"
            required={false}
            placeholder="Optional comment"
          />
          <CommentForm
            action={bind(returnDelegationForMoreWorkAction)}
            label="Return for More Work"
            tone="danger"
            required
            placeholder="Required — explain what still needs work"
          />
        </ActionSection>
      )}

      {isCeo && status === 'COMPLETED' && (
        <ActionSection title="Close this delegation">
          <form action={bind(closeDelegationAction)} className="space-y-2">
            <label htmlFor="closureDecision" className="block text-sm font-medium">
              Closure decision
            </label>
            <textarea
              id="closureDecision"
              name="closureDecision"
              rows={2}
              required
              placeholder="Required — record the closure decision"
              className="input"
            />
            <SubmitButton tone="primary">Close Delegation</SubmitButton>
          </form>
        </ActionSection>
      )}

      {isCeo && !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(status) && (
        <ActionSection title="CEO controls">
          <form action={bind(extendDelegationDueDateAction)} className="space-y-2">
            <label htmlFor="newDueDate" className="block text-sm font-medium">
              Extend due date
            </label>
            <input id="newDueDate" name="newDueDate" type="date" required className="input" />
            <textarea name="comment" rows={2} placeholder="Optional comment" className="input" />
            <SubmitButton tone="secondary">Extend Due Date</SubmitButton>
          </form>
          <CommentForm
            action={bind(addCeoCommentAction)}
            label="Add Comment"
            tone="secondary"
            required
            placeholder="Comment for the Director"
          />
          <CommentForm
            action={bind(cancelDelegationAction)}
            label="Cancel Delegation"
            tone="danger"
            required
            placeholder="Required — reason for cancelling"
          />
        </ActionSection>
      )}

      {/* Director actions */}
      {isOwnDirector && status === 'ISSUED' && (
        <ActionSection title="Acknowledge this delegation">
          <form action={bind(acknowledgeDelegationAction)}>
            <SubmitButton tone="primary">Acknowledge</SubmitButton>
          </form>
        </ActionSection>
      )}

      {isOwnDirector && status === 'ACKNOWLEDGED' && (
        <ActionSection title="Start work">
          <form action={bind(startDelegationWorkAction)}>
            <SubmitButton tone="primary">Start Work</SubmitButton>
          </form>
        </ActionSection>
      )}

      {isOwnDirector && (status === 'IN_PROGRESS' || status === 'AT_RISK') && (
        <ActionSection title="Update progress">
          <CommentForm
            action={bind(addDelegationUpdateAction)}
            label="Add Update"
            tone="secondary"
            required
            placeholder="Progress note"
          />
          {status === 'IN_PROGRESS' ? (
            <CommentForm
              action={bind(flagDelegationRiskAction)}
              label="Flag Risk"
              tone="danger"
              required
              placeholder="Required — describe the risk"
            />
          ) : (
            <CommentForm
              action={bind(clearDelegationRiskAction)}
              label="Clear Risk"
              tone="secondary"
              required={false}
              placeholder="Optional comment"
            />
          )}
          <CommentForm
            action={bind(requestDelegationExtensionAction)}
            label="Request Extension"
            tone="secondary"
            required
            placeholder="Required — reason for the extension request"
          />
          <CommentForm
            action={bind(submitDelegationForReviewAction)}
            label="Submit for Review"
            tone="primary"
            required={false}
            placeholder="Optional comment"
          />

          {/* #A32 — "Directors cannot silently decline CEO delegations. They may request
              clarification or nominate an alternate with a reason." */}
          <form action={bind(nominateDelegationAlternateAction)} className="rounded-md border border-nicta-neutral-200 bg-white p-4">
            <label className="block text-sm font-medium">Nominate an Alternate</label>
            <select name="alternateUserId" required className="input mt-2" defaultValue="">
              <option value="" disabled>
                Select an alternate Director
              </option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <textarea name="comment" rows={2} required placeholder="Required — reason for the nomination" className="input mt-2" />
            <SubmitButton tone="secondary">Nominate Alternate</SubmitButton>
          </form>

          <form action={bind(assignDelegationToManagerAction)} className="rounded-md border border-nicta-neutral-200 bg-white p-4">
            <label className="block text-sm font-medium">Assign to a Manager</label>
            <select name="managerId" required className="input mt-2" defaultValue="">
              <option value="" disabled>
                Select a Manager
              </option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <textarea name="comment" rows={2} placeholder="Optional comment" className="input mt-2" />
            <SubmitButton tone="secondary">Assign to Manager</SubmitButton>
          </form>
        </ActionSection>
      )}

      {isOwnDirector && status === 'RETURNED_FOR_MORE_WORK' && (
        <ActionSection title="Resume work">
          <CommentForm
            action={bind(resumeDelegationWorkAction)}
            label="Resume Work"
            tone="primary"
            required={false}
            placeholder="Optional comment"
          />
        </ActionSection>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-nicta-teal-dark">History</h2>
        <ol className="mt-3 space-y-4 border-l-2 border-nicta-neutral-200 pl-4">
          {delegation.transitions.map((t) => (
            <li key={t.id}>
              <p className="text-sm font-medium">
                {t.fromState === t.toState ? t.toState : `${t.fromState} → ${t.toState}`}
              </p>
              <p className="text-xs text-nicta-neutral-700">
                {nameById.get(t.performedById) ?? t.performedById} ·{' '}
                {t.performedAt.toLocaleString()}
              </p>
              {t.comment && <p className="mt-1 text-sm text-nicta-neutral-700">{t.comment}</p>}
            </li>
          ))}
        </ol>
      </section>
    </PortalShell>
  );
}

function formatPriority(priority: string): string {
  return priority.charAt(0) + priority.slice(1).toLowerCase();
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-nicta-neutral-700">{label}</dt>
      <dd className="font-medium text-nicta-neutral-900">{value}</dd>
    </div>
  );
}

function ActionSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 space-y-4">
      <p className="text-sm font-semibold text-nicta-teal-dark">{title}</p>
      {children}
    </section>
  );
}

const TONE_CLASSES: Record<'primary' | 'secondary' | 'success' | 'danger', string> = {
  primary: 'bg-nicta-charcoal text-white hover:opacity-90',
  secondary: 'border border-nicta-neutral-200 text-nicta-teal-dark hover:bg-nicta-neutral-100',
  success: 'bg-status-success text-white hover:opacity-90',
  danger: 'bg-status-danger text-white hover:opacity-90',
};

function SubmitButton({
  tone,
  children,
}: {
  tone: 'primary' | 'secondary' | 'success' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={`mt-3 rounded-md px-4 py-2 text-sm font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </button>
  );
}

function CommentForm({
  action,
  label,
  tone,
  required,
  placeholder,
}: {
  action: (formData: FormData) => Promise<void>;
  label: string;
  tone: 'primary' | 'secondary' | 'success' | 'danger';
  required: boolean;
  placeholder: string;
}) {
  return (
    <form action={action} className="rounded-md border border-nicta-neutral-200 bg-white p-4">
      <label className="block text-sm font-medium">{label}</label>
      <textarea
        name="comment"
        rows={2}
        required={required}
        placeholder={placeholder}
        className="input mt-2"
      />
      <SubmitButton tone={tone}>{label}</SubmitButton>
    </form>
  );
}
