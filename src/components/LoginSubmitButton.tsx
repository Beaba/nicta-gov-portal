'use client';

import { useFormStatus } from 'react-dom';

export function LoginSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-md bg-nicta-teal-dark px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#0c2e35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nicta-sand disabled:opacity-60"
    >
      {pending ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="3"
              strokeOpacity="0.3"
            />
            <path
              d="M21 12a9 9 0 0 0-9-9"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          Signing in…
        </>
      ) : (
        'Sign in'
      )}
    </button>
  );
}
