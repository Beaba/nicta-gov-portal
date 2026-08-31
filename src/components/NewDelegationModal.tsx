'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createDelegationAction } from '@/app/delegations/actions';
import { DELEGATION_CATEGORIES } from '@/lib/delegations/categories';
import { CloseIcon, ArrowRightIcon, PlusIcon } from '@/components/icons';

interface DirectorOption {
  id: string;
  name: string;
  departmentName: string | null;
}

interface DepartmentOption {
  id: string;
  name: string;
}

// Mirrors NewSubmissionModal's shape exactly (same trigger/dialog/error-inline pattern) — the CEO's
// "create and issue a delegation" dialog. Creates the delegation as DRAFT; issuing it (the
// CEO-visible "send to Director" moment) is a separate action on the detail page, matching the
// spec's own Draft -> Issued state split.
export function NewDelegationModal({
  directors,
  departments,
  managers = [],
}: {
  directors: DirectorOption[];
  departments: DepartmentOption[];
  managers?: DirectorOption[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function close() {
    setIsOpen(false);
    setError(null);
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createDelegationAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      close();
      router.push(`/delegations/${result.delegationId}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        <PlusIcon className="h-4 w-4" />
        New Delegation
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nicta-teal-dark/40 px-4 py-8">
          <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-nicta-neutral-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-nicta-teal">
                  CEO Delegation
                </p>
                <h2 className="text-lg font-semibold text-nicta-teal-dark">
                  Create a new delegation
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded p-1 text-nicta-neutral-700 hover:bg-nicta-neutral-100"
                aria-label="Close"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 p-5">
              <div>
                <label htmlFor="category" className="text-sm font-medium text-nicta-teal-dark">
                  Category
                </label>
                <select id="category" name="category" className="input mt-1" defaultValue="">
                  <option value="">Select a category</option>
                  {DELEGATION_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="title" className="text-sm font-medium text-nicta-teal-dark">
                  Title
                </label>
                <input id="title" name="title" required className="input mt-1" />
              </div>

              <div>
                <label htmlFor="description" className="text-sm font-medium text-nicta-teal-dark">
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  required
                  rows={3}
                  className="input mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="responsibleDirectorId"
                  className="text-sm font-medium text-nicta-teal-dark"
                >
                  Responsible Director
                </label>
                <select
                  id="responsibleDirectorId"
                  name="responsibleDirectorId"
                  required
                  className="input mt-1"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select a Director
                  </option>
                  {directors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                      {d.departmentName ? ` — ${d.departmentName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="supportingDepartmentId"
                    className="text-sm font-medium text-nicta-teal-dark"
                  >
                    Supporting department{' '}
                    <span className="font-normal text-nicta-neutral-700">(optional)</span>
                  </label>
                  <select
                    id="supportingDepartmentId"
                    name="supportingDepartmentId"
                    className="input mt-1"
                    defaultValue=""
                  >
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="priority" className="text-sm font-medium text-nicta-teal-dark">
                    Priority
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    className="input mt-1"
                    defaultValue="MEDIUM"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="startDate" className="text-sm font-medium text-nicta-teal-dark">
                    Start date
                  </label>
                  <input
                    id="startDate"
                    name="startDate"
                    type="date"
                    required
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label htmlFor="dueDate" className="text-sm font-medium text-nicta-teal-dark">
                    Due date
                  </label>
                  <input id="dueDate" name="dueDate" type="date" required className="input mt-1" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="expectedOutcome"
                  className="text-sm font-medium text-nicta-teal-dark"
                >
                  Expected outcome
                </label>
                <textarea
                  id="expectedOutcome"
                  name="expectedOutcome"
                  required
                  rows={2}
                  className="input mt-1"
                />
              </div>

              {managers.length > 0 && (
                <div>
                  <label
                    htmlFor="additionalRecipientUserIds"
                    className="text-sm font-medium text-nicta-teal-dark"
                  >
                    Additional recipients (Directors/Managers){' '}
                    <span className="font-normal text-nicta-neutral-700">(optional)</span>
                  </label>
                  <select
                    id="additionalRecipientUserIds"
                    name="additionalRecipientUserIds"
                    multiple
                    className="input mt-1 h-24"
                  >
                    {[...directors, ...managers].map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {u.departmentName ? ` — ${u.departmentName}` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-nicta-neutral-700">
                    Ctrl/Cmd-click to select several. The Director selected above stays the sole
                    accountable lead — everyone here is notified and can view the delegation.
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="requiredEvidence"
                  className="text-sm font-medium text-nicta-teal-dark"
                >
                  Required evidence{' '}
                  <span className="font-normal text-nicta-neutral-700">(optional)</span>
                </label>
                <input id="requiredEvidence" name="requiredEvidence" className="input mt-1" />
              </div>

              <div>
                <label className="text-sm font-medium text-nicta-teal-dark">Completion requires</label>
                <div className="mt-1 flex gap-4 text-sm text-nicta-neutral-900">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="completionRequirement"
                      value="EVIDENCE"
                      defaultChecked
                    />
                    Evidence or Report
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" name="completionRequirement" value="ACKNOWLEDGEMENT_ONLY" />
                    Acknowledgement Only
                  </label>
                </div>
              </div>

              <div>
                <label
                  htmlFor="confidentiality"
                  className="text-sm font-medium text-nicta-teal-dark"
                >
                  Confidentiality
                </label>
                <select
                  id="confidentiality"
                  name="confidentiality"
                  className="input mt-1"
                  defaultValue="INTERNAL"
                >
                  <option value="PUBLIC">Public</option>
                  <option value="INTERNAL">Internal</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                  <option value="RESTRICTED">Restricted</option>
                </select>
              </div>

              {error && <p className="text-sm text-status-danger">{error}</p>}

              <div className="flex items-center justify-between border-t border-nicta-neutral-200 pt-4">
                <button
                  type="button"
                  onClick={close}
                  className="rounded-md border border-nicta-neutral-200 px-4 py-2 text-sm hover:bg-nicta-neutral-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 rounded-md bg-nicta-charcoal px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {isPending ? 'Saving…' : 'Save as Draft'}
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
