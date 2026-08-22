'use client';

import { useState } from 'react';

// Corporate Secretariat's two completeness-check outcomes (#A27 moved the Board-escalation
// decision to the CEO's own panel, CeoVettingForm — Secretariat no longer has a third button
// here). They share one comment textarea, but only "Return for Correction" requires a non-empty
// comment (returnSubmissionForCorrection throws SubmissionValidationError server-side otherwise —
// see src/lib/submissions/review.ts). A single shared field can't put `required` on the textarea
// itself without also blocking Accept, which doesn't need a comment — this intercepts only the
// Return click to check client-side, so an empty-comment Return shows an inline message instead of
// hitting a raw server error.
export function ReviewActionForm({
  onReturn,
  onNote,
}: {
  onReturn: (formData: FormData) => void;
  onNote: (formData: FormData) => void;
}) {
  const [comment, setComment] = useState('');
  const [showReturnError, setShowReturnError] = useState(false);

  return (
    <form className="space-y-3">
      <div>
        <label htmlFor="review-comment" className="block text-sm font-medium text-nicta-teal-dark">
          Comments
        </label>
        <textarea
          id="review-comment"
          name="comment"
          rows={3}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            if (showReturnError && e.target.value.trim()) setShowReturnError(false);
          }}
          placeholder="Add a comment — required for Return for Correction"
          className="input mt-1"
        />
        {showReturnError && (
          <p className="mt-1 text-xs text-status-danger">
            A comment is required when returning a submission for correction.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          formAction={onReturn}
          onClick={(e) => {
            if (!comment.trim()) {
              e.preventDefault();
              setShowReturnError(true);
            }
          }}
          className="rounded-md bg-status-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Return for Correction
        </button>
        <button
          type="submit"
          formAction={onNote}
          className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Accept for SMC
        </button>
      </div>
    </form>
  );
}
