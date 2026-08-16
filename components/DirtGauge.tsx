import { DIRT_MAX, dirtColor } from "@/lib/dirtiness";

export default function DirtGauge({
  ratio,
  size = 28,
  title,
  label,
}: {
  ratio: number;
  size?: number;
  title?: string;
  label?: string;
}) {
  const color = dirtColor(ratio);
  const t = Math.min(1, Math.max(0, ratio) / DIRT_MAX);
  const r = 10;
  const circ = 2 * Math.PI * r;

  return (
    <span
      className="shrink-0 inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      title={title}
      aria-label={label ?? title}
    >
      <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
        <circle cx="14" cy="14" r={r} fill="none" stroke="var(--surface2)" strokeWidth="3.5" />
        <circle
          cx="14"
          cy="14"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - t)}
          transform="rotate(-90 14 14)"
        />
      </svg>
    </span>
  );
}
