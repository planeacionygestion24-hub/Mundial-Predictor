// components/ChampionBoard.tsx
// Tablero de proyección de campeón: barras horizontales ámbar, números mono grandes.
import type { StoredSimulation } from "@/lib/data/simulate";
import { pct1 } from "@/lib/format";

export function ChampionBoard({ sim, limit = 10 }: { sim: StoredSimulation; limit?: number }) {
  const top = sim.teams.slice(0, limit);
  const max = top[0]?.champion ?? 1;

  return (
    <div className="flex flex-col">
      {top.map((t, i) => (
        <div
          key={t.teamId}
          className={`flex items-center gap-3 px-4 py-2 ${i < top.length - 1 ? "hairline-b" : ""}`}
        >
          <span className="mono w-6 text-right text-xs" style={{ color: "var(--muted)" }}>
            {i + 1}
          </span>
          <span className="display w-36 truncate text-lg sm:w-44">{t.name}</span>
          <span className="eyebrow w-8">{t.group}</span>
          <div className="flex-1">
            <div
              className="h-4"
              style={{
                width: `${(t.champion / max) * 100}%`,
                background: i === 0 ? "var(--accent)" : "rgba(255, 196, 0, 0.45)",
                minWidth: 2,
              }}
            />
          </div>
          <span className="mono w-16 text-right text-lg">
            {pct1(t.champion)}
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              %
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
