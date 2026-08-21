import { getAuthProvider } from '@/lib/auth';
import { signInWithEmail } from '@/app/login/actions';
import { LoginSwoosh } from '@/components/LoginSwoosh';
import { LoginPatternRings } from '@/components/LoginPatternRings';
import { PasswordField } from '@/components/PasswordField';
import { ShieldLockIcon } from '@/components/icons';

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  not_provisioned:
    'No Executive Management Reporting and Board Submissions Portal account exists for that email yet. Ask your Administrator (Corporate Secretary) to add you via Administration → Manage Users, using this exact email address, then try again.',
  missing_credentials: 'Enter both your email address and password.',
  missing_code:
    'Microsoft sign-in did not complete — no authorization code was returned. Please try again.',
  sign_in_failed:
    'Microsoft sign-in could not be completed. This may be a temporary issue — please try again, or contact your Administrator if it persists.',
  invalid_state:
    'This sign-in attempt could not be verified (it may have expired, or the page was left open too long). Please try again.',
};

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const provider = getAuthProvider();
  const isEntra = provider.providerName === 'entra';
  const errorMessage = searchParams.error
    ? (LOGIN_ERROR_MESSAGES[searchParams.error] ?? 'Sign-in failed. Please try again.')
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden bg-nicta-teal-dark">
      <LoginPatternRings />
      <LoginSwoosh />

      <div className="relative mx-auto flex max-w-6xl flex-col px-6 pb-16 pt-[220px] sm:px-10 sm:pt-[300px] lg:flex-row lg:items-start lg:justify-between lg:gap-16 lg:pb-24">
        {/* Left column: headline */}
        <div className="relative max-w-xl flex-1">
          <div className="absolute -left-6 top-1 hidden h-[380px] w-px bg-nicta-sand/50 lg:block">
            <span className="absolute -left-[3px] top-[70px] h-1.5 w-1.5 rounded-full bg-nicta-sand" />
            <span className="absolute -left-[3px] top-[320px] h-1.5 w-1.5 rounded-full bg-nicta-sand" />
          </div>

          <p className="text-sm font-medium text-nicta-sand">Welcome to the</p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-white sm:text-4xl">
            Executive Management Reporting and Board Submissions Portal
          </h1>
          <div className="mt-5 h-[3px] w-16 bg-nicta-sand" />
          <p className="mt-5 text-sm text-nicta-neutral-100/90 sm:text-base">
            Submit and track papers for SMC and Board consideration.
          </p>

          <p className="mt-16 text-sm font-medium tracking-wide text-nicta-sand">
            Inform <span className="mx-1">•</span> Communicate <span className="mx-1">•</span>{' '}
            Transform
          </p>
        </div>

        {/* Right column: sign-in card */}
        <div className="mt-10 flex flex-1 justify-center lg:mt-0 lg:justify-end">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-2xl">
            <div className="flex justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-nicta-teal-light text-nicta-teal-dark">
                <ShieldLockIcon className="h-6 w-6" />
              </span>
            </div>
            <h2 className="mt-4 text-center text-lg font-bold text-nicta-teal-dark">
              Sign in with your NICTA account
            </h2>

            {errorMessage && (
              <p className="mt-4 rounded-md border border-status-danger/40 bg-status-danger-bg px-3 py-2.5 text-center text-xs text-status-danger">
                {errorMessage}
              </p>
            )}

            {isEntra ? (
              <div className="mt-6">
                <p className="mb-5 text-center text-xs text-nicta-neutral-700">
                  You&apos;ll be redirected to Microsoft to sign in securely with your @nicta.gov.pg
                  account.
                </p>
                <a
                  href="/api/auth/entra/login"
                  className="flex w-full items-center justify-center rounded-md bg-nicta-teal-dark px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  Sign in with Microsoft
                </a>
              </div>
            ) : (
              <form action={signInWithEmail} className="mt-5 space-y-4">
                <p className="text-center text-xs text-nicta-neutral-700">
                  Demonstration mode — any password is accepted for an account your Administrator
                  has already added.
                </p>
                <label className="block text-sm">
                  <span className="font-medium text-nicta-teal-dark">Email address</span>
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="username"
                    className="input mt-1 w-full"
                    placeholder="you@nicta.gov.pg"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-nicta-teal-dark">Password</span>
                  <div className="mt-1">
                    <PasswordField />
                  </div>
                </label>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-md bg-nicta-teal-dark px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  Sign in
                </button>
              </form>
            )}

            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-nicta-neutral-200" />
              <ShieldLockIcon className="h-3.5 w-3.5 shrink-0 text-nicta-neutral-700" />
              <span className="h-px flex-1 bg-nicta-neutral-200" />
            </div>
            <p className="mt-3 text-center text-xs text-nicta-neutral-700">
              Authorised NICTA personnel only
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
