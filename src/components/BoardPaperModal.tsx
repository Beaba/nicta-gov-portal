'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitBoardPaperAction } from '@/app/submissions/[id]/actions';
import { CloseIcon, UploadIcon, ArrowRightIcon } from '@/components/icons';

// Shown on an SMC submission's detail page once SEMC has endorsed it for Board — the Director
// submits a Board Paper "based on the [SEMC] comments" (client requirement). Deliberately lighter
// than NewSubmissionModal: no template picker, since the Board Paper summarises an already-vetted
// SMC paper rather than being checked against a NICTA template itself.
export function BoardPaperModal({ sourceSubmissionId }: { sourceSubmissionId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function close() {
    setIsOpen(false);
    setError(null);
    setFileName(null);
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await submitBoardPaperAction(sourceSubmissionId, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md bg-status-success px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Submit Board Paper
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nicta-teal-dark/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-nicta-neutral-200 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-status-success text-white">
                  <UploadIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-status-success">
                    Board Paper
                  </p>
                  <h2 className="text-lg font-semibold text-nicta-teal-dark">Submit Board Paper</h2>
                </div>
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
                <label htmlFor="boardSummary" className="text-sm font-medium text-nicta-teal-dark">
                  Board summary
                </label>
                <p className="text-xs text-nicta-neutral-700">
                  Summarise this paper based on SEMC&rsquo;s comments.
                </p>
                <textarea
                  id="boardSummary"
                  name="boardSummary"
                  required
                  rows={4}
                  placeholder="Summarise the SEMC discussion and what the Board is being asked to consider"
                  className="input mt-1"
                />
              </div>

              <div className="rounded-md border-2 border-dashed border-nicta-neutral-200 p-6 text-center">
                <UploadIcon className="mx-auto h-5 w-5 text-nicta-teal" />
                <p className="mt-2 text-sm font-semibold text-nicta-teal-dark">
                  Upload Board Paper
                </p>
                <p className="text-xs text-nicta-neutral-700">
                  Microsoft Word (.docx) · Maximum 25 MB
                </p>
                <label className="mt-3 inline-block cursor-pointer rounded-md border border-nicta-neutral-200 px-4 py-1.5 text-sm hover:bg-nicta-neutral-100">
                  {fileName ?? 'Select file'}
                  <input
                    type="file"
                    name="file"
                    required
                    accept=".docx,.doc"
                    className="hidden"
                    onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                  />
                </label>
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
                  className="flex items-center gap-2 rounded-md bg-status-success px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {isPending ? 'Submitting…' : 'Submit to Board'}
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
