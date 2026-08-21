import { NextResponse } from 'next/server';
import { completeEntraSignIn } from '@/lib/auth/entraProvider';
import { getSession } from '@/lib/auth/session';
import { ROLE_LANDING_PAGE, ROLE_LANDING_PRIORITY } from '@/lib/config/roles';

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const code = searchParams.get('code');
  const returnedState = searchParams.get('state');

  const session = await getSession();
  const expectedState = session.oauthState;
  session.oauthState = undefined;
  await session.save();

  if (!expectedState || !returnedState || returnedState !== expectedState) {
    // Missing/mismatched state — either a forged callback or a stale/expired login attempt
    // (session cookie cleared or replaced between /login and here). Reject rather than proceed —
    // see buildEntraAuthCodeUrl's comment for why this check exists.
    return NextResponse.redirect(new URL('/login?error=invalid_state', request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  let user;
  try {
    user = await completeEntraSignIn(code);
  } catch (err) {
    // Token exchange can fail for reasons outside our control — an expired/already-used code
    // (e.g. the user hit the browser back button after already completing sign-in), a lapsed
    // client secret, etc. Redirect to a clear error rather than surfacing a raw 500.
    console.error('Entra token exchange failed:', err);
    return NextResponse.redirect(new URL('/login?error=sign_in_failed', request.url));
  }
  if (!user) {
    // No matching provisioned User row — see docs/assumptions-and-decisions.md#A3: Entra sign-in
    // never auto-provisions access.
    return NextResponse.redirect(new URL('/login?error=not_provisioned', request.url));
  }

  const primaryRole = ROLE_LANDING_PRIORITY.find((role) =>
    user.roles.some((r) => r.roleCode === role),
  );
  return NextResponse.redirect(
    new URL(primaryRole ? ROLE_LANDING_PAGE[primaryRole] : '/login', request.url),
  );
}
