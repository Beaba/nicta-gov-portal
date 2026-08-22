'use client';

import { useState } from 'react';

// The CEO's two substantive outcomes for an accepted SMC paper (#A27) — unlike the Secretariat's
// ReviewActionForm, BOTH buttons here require a comment server-side (markEndorsedForBoard and
// markNotVettedForBoard both throw SubmissionValidationError on an empty one — see
// src/lib/submissions/review.ts), so both are guarded client-side the same way, not just one.
export function CeoVettingForm({
  onVetForBoard,
  onNotVetForBoard,
}: {
  onVetForBoard: (formData: FormData) => void;
  onNotVetForBoard: (formData: FormData) => void;
}) {
  const [comment, setComment] = useState('');
  const [error, setError] = useState(false);

  function guard(e: React.MouseEvent<HTMLButtonElement>) {
    if (!comment.trim()) {
      e.preventDefault();
      setError(true);
    }
  }

  return (
    <form className="space-y-3">
      <div>
        <label htmlFor="ceo-comment" className="block text-sm font-medium text-nicta-teal-dark">
          Comments
        </label>
        <textarea
          id="ceo-comment"
          name="comment"
          rows={3}
          value={comment}
          onChange={(e) => {
            setComment(e.target.value);
            if (error && e.target.value.trim()) setError(false);
          }}
          placeholder="Required — your comment is stored on the paper and sent to the Director"
          className="input mt-1"
        />
        {error && (
          <p className="mt-1 text-xs text-status-danger">
            A comment is required for either outcome — it&apos;s recorded against the paper and sent
            to the Director.
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="submit"
          formAction={onVetForBoard}
          onClick={guard}
          className="rounded-md bg-status-success px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Vetted for Board
        </button>
        <button
          type="submit"
          formAction={onNotVetForBoard}
          onClick={guard}
          className="rounded-md bg-nicta-charcoal px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Not Vetted for Board
        </button>
      </div>
    </form>
  );
}
