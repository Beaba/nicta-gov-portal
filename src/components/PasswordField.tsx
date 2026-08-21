'use client';

import { useState } from 'react';
import { EyeIcon, EyeOffIcon, LockIcon } from '@/components/icons';

export function PasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <LockIcon className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-nicta-neutral-700" />
      <input
        type={visible ? 'text' : 'password'}
        name="password"
        required
        autoComplete="current-password"
        className="input w-full pl-9 pr-10"
        placeholder="••••••••"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-nicta-neutral-700"
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}
