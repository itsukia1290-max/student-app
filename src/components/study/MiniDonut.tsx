export type BreakdownItem = { key: string; label: string; minutes: number };

export default function MiniDonut({
  breakdown,
  total,
  size = 64,
  stroke = 10,
  emptyAsGray = true,
}: {
  breakdown: BreakdownItem[];
  total: number;
  size?: number;
  stroke?: number;
  emptyAsGray?: boolean;
}) {
  const isEmpty = total <= 0 || breakdown.length === 0;

  const colorOf = (label: string) => {
    const map: Record<string, string> = {
      "国語": "#f97316",
      "数学": "#3b82f6",
      "英語": "#22c55e",
      "理科": "#a855f7",
      "社会": "#ef4444",
      "その他": "#64748b",
    };
    return map[label] ?? "#94a3b8";
  };

  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const sorted = isEmpty ? [] : [...breakdown].sort((a, b) => b.minutes - a.minutes);
  const top = sorted.slice(0, 5);
  const restMin = sorted.slice(5).reduce((s, x) => s + x.minutes, 0);
  const items = restMin > 0 ? [...top, { key: "__rest__", label: "その他", minutes: restMin }] : top;

  let acc = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="study breakdown donut">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={isEmpty ? (emptyAsGray ? "#e5e7eb" : "transparent") : "rgba(148,163,184,0.25)"}
        strokeWidth={stroke}
      />

      {!isEmpty &&
        items.map((b) => {
          const frac = b.minutes / total;
          const len = c * frac;
          const offset = c * (1 - acc) + c * 0.25;
          acc += frac;

          return (
            <circle
              key={b.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colorOf(b.label)}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={offset}
            />
          );
        })}

      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        style={{
          fontSize: 12,
          fontWeight: 900,
          fill: isEmpty ? "#94a3b8" : "#0f172a",
        }}
      >
        {isEmpty ? "0h" : `${(total / 60).toFixed(1)}h`}
      </text>
    </svg>
  );
}
