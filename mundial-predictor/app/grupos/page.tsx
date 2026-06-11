// app/grupos/page.tsx
import Link from "next/link";
import { latestSimulation } from "@/lib/data/simulate";
import { GROUP_LETTERS } from "@/lib/model/tournament";
import { pct, runStamp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function GruposPage() {
  const sim = await latestSimulation();

  if (!sim) {
    return (
      <div className="panel p-8">
        <h1 className="display text-3xl">Sin simulación del torneo</h1>
        <p className="mt-3" style={{ color: "var(--muted)" }}>
          El Monte Carlo corre cuando los 12 grupos están completos en la base. Corre{" "}
          <span className="mono">pnpm seed</span> (data real) o{" "}
          <span className="mono">pnpm seed:demo</span>.
        </p>
      </div>
    );
  }

  const byGroup = new Map(
    GROUP_LETTERS.map((g) => [
      g,
      sim.teams
        .filter((t) => t.group === g)
        .sort((a, b) => b.qualified - a.qualified),
    ])
  );

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <h1 className="display text-4xl">Clasificación proyectada</h1>
        <span className="eyebrow">
          {sim.iterations.toLocaleString("es-CO")} simulaciones · {runStamp(sim.runAt)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GROUP_LETTERS.map((g) => {
          const rows = byGroup.get(g) ?? [];
          if (rows.length === 0) return null;
          return (
            <section key={g} className="panel">
              <header className="hairline-b flex items-baseline justify-between px-4 py-2">
                <span className="display text-xl" style={{ color: "var(--accent)" }}>
                  Grupo {g}
                </span>
                <span className="eyebrow">1° / Top 2 / Clasifica</span>
              </header>
              <table className="mono w-full text-sm">
                <tbody>
                  {rows.map((t, i) => (
                    <tr key={t.teamId} className={i < rows.length - 1 ? "hairline-b" : ""}>
                      <td className="display px-4 py-2 text-base" style={{ fontFamily: "var(--font-display)" }}>
                        {t.name}
                      </td>
                      <td className="w-12 py-2 text-right" style={{ color: "var(--accent)" }}>
                        {pct(t.groupWinner)}
                      </td>
                      <td className="w-12 py-2 text-right">{pct(t.top2)}</td>
                      <td
                        className="w-14 py-2 pr-4 text-right"
                        style={{ color: t.qualified >= 0.5 ? "var(--ink)" : "var(--muted)" }}
                      >
                        {pct(t.qualified)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          );
        })}
      </div>

      <p className="eyebrow mt-4">
        Clasifica = top 2 del grupo o uno de los 8 mejores terceros. Bracket oficial FIFA;
        la llave exacta de cada tercero se resuelve por matching sobre los grupos permitidos.
      </p>
      <p className="mt-2">
        <Link href="/" className="eyebrow underline">
          Volver a partidos
        </Link>
      </p>
    </div>
  );
}
