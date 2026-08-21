// Faint concentric-ring motifs for the dark hero background, echoing the client mockup's
// compass-like decoration. An original abstract pattern (rings + evenly spaced tick marks) in the
// portal's own palette — not a reproduction of any specific cultural or ceremonial design. See
// docs/known-limitations.md. Drifts extremely slowly (140s/rotation) as the spec's one permitted
// "very slow movement of the thin orbit lines" — see globals.css's login-orbit-drift, a no-op
// under prefers-reduced-motion.
function Ring({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const ticks = Array.from({ length: 24 }, (_, i) => (i * Math.PI * 2) / 24);
  return (
    <g
      stroke="#F4EFE3"
      strokeOpacity="0.14"
      fill="none"
      className="login-orbit-drift"
      style={{ transformBox: 'fill-box' }}
    >
      <circle cx={cx} cy={cy} r={r} strokeWidth="1.4" />
      <circle cx={cx} cy={cy} r={r * 0.72} strokeWidth="1" />
      <circle cx={cx} cy={cy} r={r * 0.46} strokeWidth="1" />
      {ticks.map((angle, i) => {
        const x1 = cx + Math.cos(angle) * r * 1.02;
        const y1 = cy + Math.sin(angle) * r * 1.02;
        const x2 = cx + Math.cos(angle) * r * 1.09;
        const y2 = cy + Math.sin(angle) * r * 1.09;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1.4" />;
      })}
    </g>
  );
}

export function LoginPatternRings() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMid slice"
    >
      <Ring cx={1500} cy={80} r={320} />
      <Ring cx={1180} cy={760} r={420} />
    </svg>
  );
}
