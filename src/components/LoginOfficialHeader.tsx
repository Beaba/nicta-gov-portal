import Image from 'next/image';

// The official branding bar for the login page: PNG national crest, a vertical divider, and the
// NICTA logo, in that exact order, on white. No separate combined "header graphic" file was ever
// supplied to this project — these are the same two real, previously-sourced brand PNGs the rest
// of the app already uses (public/png-emblem.png, public/nicta-logo.png; see
// docs/assumptions-and-decisions.md#A17), composited in the required order rather than a
// fabricated or redrawn logo. Deliberately a plain <header>, not AppHeader — no nav, no
// notifications, no sign-out; this page has nothing to navigate away to yet.
export function LoginOfficialHeader() {
  return (
    <header className="relative z-10 flex h-[100px] shrink-0 items-center border-b border-nicta-neutral-200 bg-white px-6 sm:h-[110px] sm:px-10">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-nicta-strip" />
      <div className="flex items-center gap-4">
        <Image
          src="/png-emblem.png"
          alt="Papua New Guinea national crest"
          width={56}
          height={56}
          className="h-12 w-12 object-contain sm:h-14 sm:w-14"
        />
        <div className="h-11 w-px bg-nicta-neutral-200 sm:h-12" />
        <Image
          src="/nicta-logo.png"
          alt="NICTA — National Information & Communications Technology Authority"
          width={64}
          height={46}
          className="h-9 w-auto object-contain sm:h-11"
        />
        <div className="hidden sm:block">
          <p className="text-sm font-semibold leading-tight text-nicta-teal-dark">
            National Information &amp; Communications Technology Authority
          </p>
          <p className="text-xs font-medium tracking-wide text-nicta-turquoise">
            Inform | Communicate | Transform
          </p>
        </div>
      </div>
    </header>
  );
}
