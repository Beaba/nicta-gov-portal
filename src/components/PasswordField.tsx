'use client';

import { useState } from 'react';
import { EyeIcon, EyeOffIcon } from '@/components/icons';

export function PasswordField() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        name="password"
        required
        autoComplete="current-password"
        className="input w-full pr-10"
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
