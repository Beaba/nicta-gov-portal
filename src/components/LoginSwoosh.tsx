import Image from 'next/image';

// Cream wave panel across the top-left of the login hero, carrying the NICTA wordmark — matches
// the client-supplied login mockup's layout. preserveAspectRatio="none" so the hand-drawn curve
// fills its box predictably at any viewport width, at the cost of some stretch on extreme aspect
// ratios (acceptable for a decorative shape).
export function LoginSwoosh() {
  return (
    <div className="absolute inset-x-0 top-0 h-[220px] w-full sm:h-[300px]">
      <svg
        viewBox="0 0 1000 400"
        preserveAspectRatio="xMinYMin slice"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path
          d="M0,280 C180,230 320,70 520,55 C600,48 630,150 710,115 C810,75 790,10 860,8 C900,5 950,2 1000,0 L1000,0 L0,0 Z"
          fill="#F4EFE3"
        />
      </svg>
      <div className="relative flex items-center gap-3 px-8 py-8 sm:px-12 sm:py-10">
        <Image src="/nicta-logo.png" alt="NICTA official logo" width={56} height={40} />
        <p className="text-sm font-semibold leading-tight text-nicta-teal-dark">
          Inform Communicate
          <br />
          Transform
        </p>
      </div>
    </div>
  );
}
