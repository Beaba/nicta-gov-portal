'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createAndSubmitPaperAction } from '@/app/submissions/actions';
import {
  CloseIcon,
  UploadIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PlusIcon,
} from '@/components/icons';

interface TemplateOption {
  id: string;
  name: string;
  version: number;
  filePath: string;
}

// Matches the reference design's "Upload completed paper" dialog exactly: title + approved
// template + file, one "Submit to SMC" action — see docs/mvp-directors-portal-plan.md. Both
// trigger buttons ("Upload SMC paper" and the CTA banner's "Start submission") open this same
// dialog, per what the reference prototype does. `variant` (not a render-prop function) picks
// which trigger renders — a Server Component page can't pass a closure across the Client
// Component boundary, only serializable props.
export function NewSubmissionModal({
  templates,
  variant,
}: {
  templates: TemplateOption[];
  variant: 'button' | 'banner';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? '');
  const [fileName, setFileName] = useState<string | null>(null);
  const [annexureNames, setAnnexureNames] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  function close() {
    setIsOpen(false);
    setError(null);
    setFileName(null);
    setAnnexureNames([]);
    formRef.current?.reset();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await createAndSubmitPaperAction(formData);
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
      {variant === 'button' ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <PlusIcon className="h-4 w-4" />
          Upload SMC paper
        </button>
      ) : (
        <div className="mt-6 flex items-center justify-between rounded-md bg-nicta-banner p-6 text-white">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-md border border-white/40">
              <UploadIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                New Submission
              </p>
              <p className="text-lg font-semibold">Submit a paper to SMC</p>
              <p className="text-sm text-white/80">
                Select the approved format, upload the completed Word document and submit.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 whitespace-nowrap rounded-md bg-white px-4 py-2 text-sm font-semibold text-nicta-teal"
          >
            Start submission
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-nicta-teal-dark/40 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-nicta-neutral-200 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-md bg-nicta-teal text-white">
                  <UploadIcon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-nicta-teal">
                    SMC Submission
                  </p>
                  <h2 className="text-lg font-semibold text-nicta-teal-dark">
                    Upload completed paper
                  </h2>
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
                <label htmlFor="title" className="text-sm font-medium text-nicta-teal-dark">
                  Paper title
                </label>
                <input
                  id="title"
                  name="title"
                  required
                  placeholder="Enter paper title"
                  className="input mt-1"
                />
              </div>

              <div>
                <label htmlFor="templateId" className="text-sm font-medium text-nicta-teal-dark">
                  Approved NICTA template
                </label>
                <select
                  id="templateId"
                  name="templateId"
                  required
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="input mt-1"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — Version {t.version}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="purpose" className="text-sm font-medium text-nicta-teal-dark">
                  Paper description
                </label>
                <textarea
                  id="purpose"
                  name="purpose"
                  required
                  rows={3}
                  placeholder="Briefly describe the purpose of this paper"
                  className="input mt-1"
                />
              </div>

              {selectedTemplate && (
                <div className="flex items-start gap-3 rounded-md border-l-4 border-nicta-turquoise bg-nicta-teal-light p-3">
                  <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-nicta-turquoise" />
                  <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-nicta-teal">
                      Approved NICTA Template
                    </p>
                    <p className="text-sm font-semibold text-nicta-teal-dark">
                      Current template selected
                    </p>
                    <p className="text-xs text-nicta-neutral-700">
                      The submitted document will be checked against this format.
                    </p>
                  </div>
                  <a
                    href={`/api/documents/local/${selectedTemplate.filePath}`}
                    className="whitespace-nowrap text-xs font-semibold text-nicta-teal hover:underline"
                  >
                    Download template
                  </a>
                </div>
              )}

              <div className="rounded-md border-2 border-dashed border-nicta-neutral-200 p-6 text-center">
                <UploadIcon className="mx-auto h-5 w-5 text-nicta-teal" />
                <p className="mt-2 text-sm font-semibold text-nicta-teal-dark">Upload paper</p>
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

              <div>
                <label htmlFor="annexures" className="text-sm font-medium text-nicta-teal-dark">
                  Annexures <span className="font-normal text-nicta-neutral-700">(optional)</span>
                </label>
                <label className="mt-1 flex cursor-pointer items-center justify-between rounded-md border border-nicta-neutral-200 px-3 py-2 text-sm hover:bg-nicta-neutral-100">
                  <span className="text-nicta-neutral-700">
                    {annexureNames.length > 0
                      ? annexureNames.join(', ')
                      : 'Attach supporting documents'}
                  </span>
                  <span className="whitespace-nowrap font-medium text-nicta-teal">
                    Select files
                  </span>
                  <input
                    type="file"
                    name="annexures"
                    multiple
                    className="hidden"
                    onChange={(e) =>
                      setAnnexureNames(Array.from(e.target.files ?? []).map((f) => f.name))
                    }
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
                  className="flex items-center gap-2 rounded-md bg-nicta-charcoal px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                >
                  {isPending ? 'Submitting…' : 'Submit to SMC'}
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
