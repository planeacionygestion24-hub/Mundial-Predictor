// Número grande de probabilidad, protagonista del look broadcast.
import { pct } from "@/lib/format";

export function BigPct({
  value,
  label,
  color = "var(--ink)",
}: {
  value: number;
  label: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="mono leading-none" style={{ fontSize: 44, fontWeight: 600, color }}>
        {pct(value)}
        <span style={{ fontSize: 18, color: "var(--muted)" }}>%</span>
      </span>
      <span className="eyebrow">{label}</span>
    </div>
  );
}
