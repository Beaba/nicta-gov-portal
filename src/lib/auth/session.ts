import { cookies } from 'next/headers';
import { getIronSession, type SessionOptions } from 'iron-session';
import { getEnv } from '@/lib/config/env';

// The session cookie deliberately stores only an opaque user id (and, for the Entra provider,
// an OAuth token cache reference) — never roles or department. Roles/department are re-read from
// the database on every request. See docs/assumptions-and-decisions.md#A3.
export interface PortalSessionData {
  userId?: string;
  entraAccountHomeId?: string;
  /** CSRF protection for the Entra OAuth redirect — set at /api/auth/entra/login, checked and
   * cleared at /api/auth/entra/callback. Riding the existing encrypted session cookie avoids
   * adding a second raw cookie just to carry one short-lived random value. */
  oauthState?: string;
}

function sessionOptions(): SessionOptions {
  const env = getEnv();
  return {
    password: env.SESSION_SECRET,
    cookieName: 'nicta_portal_session',
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  };
}

export async function getSession() {
  return getIronSession<PortalSessionData>(cookies(), sessionOptions());
}
