// Thin muted-gold "communication orbit" curves and a couple of small glowing points, positioned
// between the introduction text and the sign-in card. Original/abstract, not a reproduction of any
// specific artwork — same rule as LoginPatternRings. The curves drift extremely slowly and the
// points pulse softly (globals.css's login-orbit-drift / login-glow-pulse), both no-ops under
// prefers-reduced-motion.
export function LoginOrbitDecor() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <g
        className="login-orbit-drift"
        style={{ transformBox: 'fill-box', transformOrigin: '900px 540px' }}
        stroke="#C9AF7F"
        strokeOpacity="0.4"
        strokeWidth="1.2"
        fill="none"
      >
        <circle cx="900" cy="540" r="230" />
        <circle cx="960" cy="460" r="150" />
      </g>
      <circle cx="900" cy="770" r="4" fill="#C9AF7F" className="login-glow-pulse" />
      <circle cx="670" cy="540" r="3" fill="#C9AF7F" className="login-glow-pulse-delayed" />
    </svg>
  );
}
