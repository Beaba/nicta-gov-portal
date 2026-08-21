import { getAuthProvider } from '@/lib/auth';
import { signInWithEmail } from '@/app/login/actions';
import { LoginOfficialHeader } from '@/components/LoginOfficialHeader';
import { LoginSwoosh } from '@/components/LoginSwoosh';
import { LoginPatternRings } from '@/components/LoginPatternRings';
import { LoginOrbitDecor } from '@/components/LoginOrbitDecor';
import { PasswordField } from '@/components/PasswordField';
import { LoginSubmitButton } from '@/components/LoginSubmitButton';
import { ShieldLockIcon, EnvelopeIcon } from '@/components/icons';

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  not_provisioned:
    'No NICTA Board Submission Portal account exists for that email yet. Ask your Administrator (Corporate Secretary) to add you via Administration → Manage Users, using this exact email address, then try again.',
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
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <LoginOfficialHeader />

      <main className="relative flex-1 overflow-hidden bg-nicta-teal-dark">
        <LoginPatternRings />
        <LoginOrbitDecor />
        <LoginSwoosh />

        <div className="relative z-10 mx-auto flex h-full max-w-6xl flex-col justify-center gap-10 px-6 py-10 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:py-0">
          {/* Left column: portal introduction */}
          <div className="relative max-w-xl">
            <div className="absolute -left-6 top-1 hidden h-[280px] w-px bg-nicta-sand/50 lg:block">
              <span className="absolute -left-[3px] top-[60px] h-1.5 w-1.5 rounded-full bg-nicta-sand" />
              <span className="absolute -left-[3px] top-[220px] h-1.5 w-1.5 rounded-full bg-nicta-sand" />
            </div>

            <p className="text-sm font-medium text-nicta-sand">Welcome to the</p>
            <h1 className="mt-2 text-3xl font-bold leading-tight text-white sm:text-4xl">
              NICTA Board
              <br />
              Submission Portal
            </h1>
            <div className="mt-4 h-[3px] w-16 bg-nicta-sand" />
            <p className="mt-4 text-sm text-nicta-neutral-100/90 sm:text-base">
              Submit and track papers for SMC and Board consideration.
            </p>

            <p className="mt-8 text-sm font-medium tracking-wide text-nicta-sand lg:mt-14">
              Inform <span className="mx-1">•</span> Communicate <span className="mx-1">•</span>{' '}
              Transform
            </p>
          </div>

          {/* Right column: sign-in card */}
          <div className="flex justify-center lg:justify-end">
            <div className="login-card-enter w-full max-w-[420px] rounded-2xl bg-white p-7 shadow-xl sm:p-8">
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
                    You&apos;ll be redirected to Microsoft to sign in securely with your
                    @nicta.gov.pg account.
                  </p>
                  <a
                    href="/api/auth/entra/login"
                    className="flex w-full items-center justify-center rounded-md bg-nicta-teal-dark px-6 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#0c2e35]"
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
                    <div className="relative mt-1">
                      <EnvelopeIcon className="pointer-events-none absolute inset-y-0 left-3 my-auto h-4 w-4 text-nicta-neutral-700" />
                      <input
                        type="email"
                        name="email"
                        required
                        autoComplete="username"
                        className="input w-full pl-9"
                        placeholder="you@nicta.gov.pg"
                      />
                    </div>
                  </label>

                  <label className="block text-sm">
                    <span className="font-medium text-nicta-teal-dark">Password</span>
                    <div className="mt-1">
                      <PasswordField />
                    </div>
                  </label>

                  <div className="flex items-center justify-between text-xs text-nicta-neutral-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="rememberMe"
                        defaultChecked
                        className="h-4 w-4 rounded border-nicta-neutral-200 text-nicta-teal focus:ring-1 focus:ring-nicta-teal"
                      />
                      Remember me
                    </label>
                    <details className="group relative">
                      <summary className="cursor-pointer list-none text-nicta-teal hover:underline [&::-webkit-details-marker]:hidden">
                        Forgot password?
                      </summary>
                      <p className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-nicta-neutral-200 bg-white p-3 text-xs text-nicta-neutral-700 shadow-lg">
                        Portal access is managed by your Administrator (Corporate Secretary), not a
                        self-service password — reach out to them if you can&apos;t sign in.
                      </p>
                    </details>
                  </div>

                  <LoginSubmitButton />
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
    </div>
  );
}
