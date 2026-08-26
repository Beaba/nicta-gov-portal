// Hand-rolled inline SVG line chart — same "no chart-library dependency" convention as this app's
// hand-rolled icon set (icons.tsx). Renders 1-2 named series (percentages, 0-100) against a shared
// set of x-axis labels. Deliberately simple: no zoom/tooltip/animation, matching what the approved
// CEO Dashboard mockup actually shows (a static labelled trend line).
export function TrendLineChart({
  labels,
  series,
  height = 220,
}: {
  labels: string[];
  series: { name: string; values: number[]; color: string }[];
  height?: number;
}) {
  const width = 700;
  const paddingLeft = 40;
  const paddingBottom = 28;
  const paddingTop = 16;
  const plotWidth = width - paddingLeft - 16;
  const plotHeight = height - paddingTop - paddingBottom;

  const xFor = (i: number) =>
    paddingLeft + (labels.length > 1 ? (i / (labels.length - 1)) * plotWidth : plotWidth / 2);
  const yFor = (value: number) =>
    paddingTop + plotHeight - (Math.max(0, Math.min(100, value)) / 100) * plotHeight;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Organisational KPI and KRA progress trend"
    >
      {gridLines.map((g) => (
        <g key={g}>
          <line
            x1={paddingLeft}
            x2={width - 16}
            y1={yFor(g)}
            y2={yFor(g)}
            stroke="#E4E1D8"
            strokeWidth={1}
          />
          <text x={4} y={yFor(g) + 4} fontSize={10} fill="#6B7280">
            {g}%
          </text>
        </g>
      ))}

      {labels.map((label, i) => (
        <text
          key={label}
          x={xFor(i)}
          y={height - 8}
          fontSize={10}
          fill="#6B7280"
          textAnchor="middle"
        >
          {label}
        </text>
      ))}

      {series.map((s) => (
        <g key={s.name}>
          <polyline
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ')}
          />
          {s.values.map((v, i) => (
            <circle key={i} cx={xFor(i)} cy={yFor(v)} r={3} fill={s.color} />
          ))}
        </g>
      ))}

      <foreignObject x={paddingLeft} y={0} width={width - paddingLeft} height={16}>
        <div className="flex gap-4 text-[11px] text-nicta-neutral-700">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </span>
          ))}
        </div>
      </foreignObject>
    </svg>
  );
}
