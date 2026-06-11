// Barra apilada 1X2. Server component, sin estado.
import { pct } from "@/lib/format";

export function ProbBar({
  home,
  draw,
  away,
  height = 10,
}: {
  home: number;
  draw: number;
  away: number;
  height?: number;
}) {
  return (
    <div
      className="flex w-full overflow-hidden"
      style={{ height }}
      role="img"
      aria-label={`Local ${pct(home)}%, empate ${pct(draw)}%, visitante ${pct(away)}%`}
    >
      <div style={{ width: `${home * 100}%`, background: "var(--accent)" }} />
      <div style={{ width: `${draw * 100}%`, background: "var(--draw)" }} />
      <div style={{ width: `${away * 100}%`, background: "var(--away)" }} />
    </div>
  );
}
