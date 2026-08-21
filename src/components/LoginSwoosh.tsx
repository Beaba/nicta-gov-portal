// Purely decorative cream curve sweeping in from the upper-left of the hero area — the NICTA
// logo used to live inside this shape, but now lives in the dedicated white LoginOfficialHeader
// bar above it instead, so this is background only. preserveAspectRatio="none" so the hand-drawn
// curve fills its box predictably at any hero width, at the cost of some stretch on extreme
// aspect ratios (acceptable for a decorative shape).
export function LoginSwoosh() {
  return (
    <svg
      viewBox="0 0 1000 400"
      preserveAspectRatio="xMinYMin slice"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[130px] w-full sm:h-[200px] lg:h-[46%] xl:h-[52%]"
      aria-hidden="true"
    >
      <path
        d="M0,220 C160,180 300,60 480,48 C560,42 590,130 660,100 C750,64 730,10 800,8 C880,4 940,2 1000,0 L1000,0 L0,0 Z"
        fill="#F4EFE3"
      />
    </svg>
  );
}
