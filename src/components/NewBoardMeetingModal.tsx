'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createBoardMeetingAction } from '@/app/board/meetings/actions';
import { CloseIcon, ArrowRightIcon, PlusIcon } from '@/components/icons';

export function NewBoardMeetingModal() {
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
      const result = await createBoardMeetingAction(formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      close();
      router.push(`/board/meetings/${result.meetingId}`);
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
        Schedule Meeting
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nicta-teal-dark/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-nicta-neutral-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-nicta-teal">
                  Board Secretariat
                </p>
                <h2 className="text-lg font-semibold text-nicta-teal-dark">
                  Schedule a Board meeting
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
                <label htmlFor="title" className="text-sm font-medium text-nicta-teal-dark">
                  Meeting title
                </label>
                <input id="title" name="title" required className="input mt-1" />
              </div>

              <div>
                <label htmlFor="meetingDate" className="text-sm font-medium text-nicta-teal-dark">
                  Date and time
                </label>
                <input
                  id="meetingDate"
                  name="meetingDate"
                  type="datetime-local"
                  required
                  className="input mt-1"
                />
              </div>

              <div>
                <label htmlFor="venue" className="text-sm font-medium text-nicta-teal-dark">
                  Venue or meeting link{' '}
                  <span className="font-normal text-nicta-neutral-700">(optional)</span>
                </label>
                <input id="venue" name="venue" className="input mt-1" />
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
                  {isPending ? 'Creating…' : 'Create Meeting'}
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
