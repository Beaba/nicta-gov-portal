'use client';

import { useState } from 'react';

// The three review actions share one comment textarea (client requirement: one compact panel, not
// three separate forms), but only "Return for Correction" requires a non-empty comment
// (returnSubmissionForCorrection throws SubmissionValidationError server-side otherwise — see
// src/lib/submissions/review.ts). The old separate-forms page could put `required` directly on
// that one textarea; a single shared field can't do that without also blocking the other two
// actions, which don't need a comment. This intercepts only the Return click to check client-side,
// so an empty-comment Return shows an inline message instead of hitting a raw server error.
export function ReviewActionForm({
  onReturn,
  onNote,
  onEndorse,
}: {
  onReturn: (formData: FormData) => void;
  onNote: (formData: FormData) => void;
  onEndorse: (formData: FormData) => void;
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
        <button
          type="submit"
          formAction={onEndorse}
          className="rounded-md bg-status-success px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Vetted for Board
        </button>
      </div>
    </form>
  );
}
