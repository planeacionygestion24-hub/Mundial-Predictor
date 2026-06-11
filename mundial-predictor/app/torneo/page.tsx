// app/torneo/page.tsx
// Camino del torneo: probabilidad de cada equipo de alcanzar cada ronda,
// goles proyectados en el torneo completo, y los cruces de dieciseisavos
// que el modelo ve más probables.
import Link from "next/link";
import { latestSimulation } from "@/lib/data/simulate";
import { pct, pct1, runStamp } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROUNDS: Array<{ key: "qualified" | "r16" | "qf" | "sf" | "final" | "champion"; label: string }> = [
  { key: "qualified", label: "16avos" },
  { key: "r16", label: "8vos" },
  { key: "qf", label: "4tos" },
  { key: "sf", label: "Semis" },
  { key: "final", label: "Final" },
  { key: "champion", label: "Campeón" },
];

export default async function TorneoPage() {
  const sim = await latestSimulation();

  if (!sim) {
    return (
      <div className="panel p-8">
        <h1 className="display text-3xl">Sin simulación del torneo</h1>
        <p className="mt-3" style={{ color: "var(--muted)" }}>
          Corre <span className="mono">pnpm seed</span> o{" "}
          <span className="mono">pnpm seed:demo</span> primero.
        </p>
      </div>
    );
  }

  const teams = [...sim.teams].sort((a, b) => b.champion - a.champion);
  const maxGoals = Math.max(...teams.map((t) => t.expGoals ?? 0), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <h1 className="display text-4xl">Camino del torneo</h1>
        <span className="eyebrow">
          {sim.iterations.toLocaleString("es-CO")} simulaciones · {runStamp(sim.runAt)}
        </span>
      </div>

      {/* Tabla ronda a ronda */}
      <section className="panel overflow-x-auto">
        <table className="mono w-full text-sm" style={{ minWidth: 720 }}>
          <thead>
            <tr className="hairline-b">
              <th className="eyebrow px-4 py-2 text-left font-normal">#</th>
              <th className="eyebrow py-2 text-left font-normal">Equipo</th>
              <th className="eyebrow py-2 text-left font-normal">Gr</th>
              <th className="eyebrow py-2 text-right font-normal" title="Goles proyectados en el torneo">
                GF proy
              </th>
              {ROUNDS.map((r) => (
                <th key={r.key} className="eyebrow py-2 pr-3 text-right font-normal">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.teamId} className="hairline-b last:border-0">
                <td className="px-4 py-2" style={{ color: "var(--muted)" }}>
                  {i + 1}
                </td>
                <td className="display py-2 text-base">{t.name}</td>
                <td className="eyebrow py-2">{t.group}</td>
                <td className="py-2 text-right" style={{ color: "var(--muted)" }}>
                  {(t.expGoals ?? 0).toFixed(1)}
                </td>
                {ROUNDS.map((r) => {
                  const v = t[r.key];
                  const isChampion = r.key === "champion";
                  return (
                    <td
                      key={r.key}
                      className="py-2 pr-3 text-right"
                      style={{
                        color: isChampion
                          ? "var(--accent)"
                          : v >= 0.5
                            ? "var(--ink)"
                            : "var(--muted)",
                      }}
                    >
                      {isChampion ? pct1(v) : pct(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Cruces más probables del R32 */}
      {sim.r32Matchups && (
        <section className="panel">
          <header className="hairline-b flex items-baseline justify-between px-4 py-2">
            <span className="eyebrow">Dieciseisavos más probables</span>
            <span className="eyebrow">Bracket oficial FIFA · top cruce por llave</span>
          </header>
          <div className="grid sm:grid-cols-2">
            {sim.r32Matchups.map((m, i) => {
              const top = m.top[0];
              if (!top) return null;
              return (
                <div
                  key={m.match}
                  className={`flex items-center gap-3 px-4 py-2 ${
                    i < sim.r32Matchups!.length - 2 ? "hairline-b" : ""
                  }`}
                >
                  <span className="mono w-8 text-xs" style={{ color: "var(--muted)" }}>
                    P{m.match}
                  </span>
                  <span className="eyebrow w-28 shrink-0">
                    {m.homeSlot} vs {m.awaySlot}
                  </span>
                  <span className="display flex-1 truncate text-base">
                    {top.home} <span style={{ color: "var(--muted)" }}>vs</span> {top.away}
                  </span>
                  <span className="mono text-sm" style={{ color: "var(--accent)" }}>
                    {pct(top.prob)}%
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="eyebrow">
        GF proy = goles del equipo en todo el torneo promediados sobre las simulaciones
        (insumo de la futura Bota de Oro).{" "}
        <Link href="/grupos" className="underline">
          Ver grupos
        </Link>
      </p>
    </div>
  );
}
