'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addActionItemAction } from '@/app/submissions/[id]/actions';

export interface ActionItemView {
  id: string;
  description: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
}

const STATUS_TONES: Record<string, string> = {
  OPEN: 'bg-status-warning-bg text-status-warning',
  IN_PROGRESS: 'bg-status-info-bg text-status-info',
  DONE: 'bg-status-success-bg text-status-success',
  OVERDUE: 'bg-status-danger-bg text-status-danger',
};

// CEO and Corporate Secretary can "put action items and description on your paper" — client
// requirement, see docs/mvp-directors-portal-plan.md#A18. `canAdd` gates the add-form only; the
// list itself is visible to anyone who can already see the submission.
export function ActionItemsSection({
  submissionId,
  items,
  canAdd,
}: {
  submissionId: string;
  items: ActionItemView[];
  canAdd: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await addActionItemAction(submissionId, formData);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <section className="mt-6 rounded-md border border-nicta-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-nicta-neutral-900">Action Items</h2>

      {items.length === 0 ? (
        <p className="mt-2 text-sm text-nicta-neutral-700">No action items yet.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-md border border-nicta-neutral-200 p-3"
            >
              <div>
                <p className="text-sm text-nicta-teal-dark">{item.description}</p>
                {item.dueDate && (
                  <p className="text-xs text-nicta-neutral-700">
                    Due {item.dueDate.toLocaleDateString()}
                  </p>
                )}
              </div>
              <span
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONES[item.status] ?? ''}`}
              >
                {item.status.replace(/_/g, ' ')}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="mt-4 space-y-2 border-t border-nicta-neutral-200 pt-4"
        >
          <textarea
            name="description"
            required
            rows={2}
            placeholder="Add an action item description"
            className="input"
          />
          <div className="flex items-center gap-3">
            <input type="date" name="dueDate" className="input w-auto" />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-nicta-charcoal px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {isPending ? 'Adding…' : 'Add Action Item'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
