// app/page.tsx
import Link from "next/link";
import { upcomingFixtures } from "@/lib/data/queries";
import { ProbBar } from "@/components/ProbBar";
import { kickoff, pct, runStamp } from "@/lib/format";
import { latestSimulation } from "@/lib/data/simulate";
import { ChampionBoard } from "@/components/ChampionBoard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [fixturesList, sim] = await Promise.all([upcomingFixtures(), latestSimulation()]);

  if (fixturesList.length === 0) {
    return (
      <div className="panel p-8">
        <h1 className="display text-3xl">Sin partidos en la base</h1>
        <p className="mt-3" style={{ color: "var(--muted)" }}>
          Corre <span className="mono">pnpm seed</span> con tu APIFOOTBALL_KEY para cargar el
          fixture real, o <span className="mono">pnpm seed:demo</span> para ver la interfaz con
          datos de ejemplo.
        </p>
      </div>
    );
  }

  const lastRun = fixturesList.find((f) => f.runAt)?.runAt;

  return (
    <div>
      {sim && (
        <section className="panel mb-6">
          <header className="hairline-b flex items-baseline justify-between px-4 py-2">
            <span className="eyebrow">Proyección de campeón</span>
            <span className="eyebrow">
              {sim.iterations.toLocaleString("es-CO")} simulaciones ·{" "}
              <Link href="/grupos" className="underline">
                ver grupos
              </Link>
            </span>
          </header>
          <ChampionBoard sim={sim} />
        </section>
      )}

      <div className="mb-5 flex items-end justify-between">
        <h1 className="display text-4xl">Próximos partidos</h1>
        {lastRun && (
          <span className="eyebrow">Última corrida {runStamp(lastRun)}</span>
        )}
      </div>

      <div className="panel">
        {fixturesList.map((f, i) => {
          const m = f.prediction?.markets;
          const fav =
            m === undefined
              ? null
              : m.oneXTwo.home >= m.oneXTwo.away
                ? { name: f.home.name, p: m.oneXTwo.home }
                : { name: f.away.name, p: m.oneXTwo.away };
          return (
            <Link
              key={f.id}
              href={`/match/${f.id}`}
              className={`block px-4 py-3 no-underline transition-colors hover:bg-[var(--panel-2)] ${
                i < fixturesList.length - 1 ? "hairline-b" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <span className="eyebrow w-28 shrink-0">{kickoff(f.date)}</span>
                <span className="display flex-1 text-lg">
                  {f.home.name} <span style={{ color: "var(--muted)" }}>vs</span> {f.away.name}
                </span>
                {m && fav && (
                  <>
                    <div className="hidden w-40 sm:block">
                      <ProbBar
                        home={m.oneXTwo.home}
                        draw={m.oneXTwo.draw}
                        away={m.oneXTwo.away}
                        height={8}
                      />
                    </div>
                    <span className="mono w-24 shrink-0 text-right text-sm">
                      <span style={{ color: "var(--accent)" }}>{pct(fav.p)}%</span>{" "}
                      <span className="eyebrow">{fav.name.slice(0, 3)}</span>
                    </span>
                  </>
                )}
                {!m && <span className="eyebrow">Sin predicción</span>}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-3 flex gap-4">
        <span className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          <i className="inline-block h-2 w-4" style={{ background: "var(--accent)" }} /> Local
        </span>
        <span className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          <i className="inline-block h-2 w-4" style={{ background: "var(--draw)" }} /> Empate
        </span>
        <span className="flex items-center gap-2 text-xs" style={{ color: "var(--muted)" }}>
          <i className="inline-block h-2 w-4" style={{ background: "var(--away)" }} /> Visitante
        </span>
      </div>
    </div>
  );
}
