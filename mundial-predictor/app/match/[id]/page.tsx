// app/match/[id]/page.tsx
import { notFound } from "next/navigation";
import { fixtureById } from "@/lib/data/queries";
import { Panel } from "@/components/Panel";
import { ProbBar } from "@/components/ProbBar";
import { BigPct } from "@/components/BigPct";
import { HeatGrid } from "@/components/HeatGrid";
import { kickoff, pct, pct1, runStamp, xg } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const f = await fixtureById(Number(id));
  if (!f) notFound();

  const p = f.prediction;
  if (!p) {
    return (
      <div className="panel p-8">
        <h1 className="display text-3xl">
          {f.home.name} vs {f.away.name}
        </h1>
        <p className="mt-3" style={{ color: "var(--muted)" }}>
          Todavía no hay predicción para este partido. Corre{" "}
          <span className="mono">pnpm cron:run</span>.
        </p>
      </div>
    );
  }

  const m = p.markets;

  return (
    <div className="flex flex-col gap-3">
      {/* Cabecera del partido */}
      <div className="panel p-5">
        <div className="eyebrow mb-3 flex flex-wrap gap-x-4 gap-y-1">
          {f.home.group && <span>{f.home.group}</span>}
          {f.round && <span>{f.round}</span>}
          <span>{kickoff(f.date)}</span>
          {f.runAt && <span>Corrida {runStamp(f.runAt)}</span>}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-5xl sm:text-6xl">{f.home.name}</h1>
            <span className="mono text-sm" style={{ color: "var(--accent)" }}>
              xG {xg(p.lambdas.home)}
            </span>
          </div>
          <span className="display pb-2 text-2xl" style={{ color: "var(--muted)" }}>
            vs
          </span>
          <div className="text-right">
            <h1 className="display text-5xl sm:text-6xl">{f.away.name}</h1>
            <span className="mono text-sm" style={{ color: "var(--away)" }}>
              xG {xg(p.lambdas.away)}
            </span>
          </div>
        </div>
      </div>

      {/* 1X2 */}
      <Panel label="Resultado · 1X2">
        <div className="mb-4 grid grid-cols-3 gap-4">
          <BigPct value={m.oneXTwo.home} label={`Gana ${f.home.name}`} color="var(--accent)" />
          <div className="text-center">
            <BigPct value={m.oneXTwo.draw} label="Empate" />
          </div>
          <div className="text-right">
            <BigPct value={m.oneXTwo.away} label={`Gana ${f.away.name}`} color="var(--away)" />
          </div>
        </div>
        <ProbBar home={m.oneXTwo.home} draw={m.oneXTwo.draw} away={m.oneXTwo.away} height={14} />
      </Panel>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Doble oportunidad */}
        <Panel label="Doble oportunidad">
          <table className="mono w-full text-sm">
            <tbody>
              {[
                [`${f.home.name} o empate`, m.doubleChance.homeOrDraw],
                ["Sin empate", m.doubleChance.homeOrAway],
                [`Empate o ${f.away.name}`, m.doubleChance.drawOrAway],
              ].map(([label, value]) => (
                <tr key={String(label)} className="hairline-b last:border-0">
                  <td className="py-2" style={{ color: "var(--muted)" }}>
                    {label}
                  </td>
                  <td className="py-2 text-right text-lg">{pct(Number(value))}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Over/Under */}
        <Panel label="Goles · Over/Under">
          <table className="mono w-full text-sm">
            <thead>
              <tr className="hairline-b">
                <th className="eyebrow py-2 text-left font-normal">Línea</th>
                <th className="eyebrow py-2 text-right font-normal">Over</th>
                <th className="eyebrow py-2 text-right font-normal">Under</th>
              </tr>
            </thead>
            <tbody>
              {m.totals.map((t) => (
                <tr key={t.line} className="hairline-b last:border-0">
                  <td className="py-2" style={{ color: "var(--muted)" }}>
                    {t.line}
                  </td>
                  <td className="py-2 text-right text-lg" style={{ color: "var(--accent)" }}>
                    {pct(t.over)}%
                  </td>
                  <td className="py-2 text-right text-lg">{pct(t.under)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* BTTS */}
        <Panel label="Ambos marcan">
          <div className="flex items-end justify-between">
            <BigPct value={m.btts.yes} label="Sí" color="var(--accent)" />
            <div className="text-right">
              <BigPct value={m.btts.no} label="No" />
            </div>
          </div>
        </Panel>

        {/* Clean sheet / gana a cero */}
        <Panel label="Portería en cero">
          <table className="mono w-full text-sm">
            <tbody>
              {[
                [`${f.home.name} no recibe gol`, m.cleanSheet.home],
                [`${f.away.name} no recibe gol`, m.cleanSheet.away],
                [`${f.home.name} gana a cero`, m.winToNil.home],
                [`${f.away.name} gana a cero`, m.winToNil.away],
              ].map(([label, value]) => (
                <tr key={String(label)} className="hairline-b last:border-0">
                  <td className="py-2" style={{ color: "var(--muted)" }}>
                    {label}
                  </td>
                  <td className="py-2 text-right text-lg">{pct(Number(value))}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* Marcador exacto: la firma visual */}
      <Panel label="Marcador exacto">
        <div className="grid gap-6 sm:grid-cols-[1fr_220px]">
          <HeatGrid matrix={p.matrix} homeName={f.home.name} awayName={f.away.name} />
          <div>
            <span className="eyebrow">Top 5</span>
            <ul className="mono mt-2">
              {m.exactScores.map((s, i) => (
                <li
                  key={`${s.home}-${s.away}`}
                  className="hairline-b flex items-baseline justify-between py-2 last:border-0"
                >
                  <span
                    className="text-2xl"
                    style={{ color: i === 0 ? "var(--accent)" : "var(--ink)" }}
                  >
                    {s.home}-{s.away}
                  </span>
                  <span style={{ color: "var(--muted)" }}>{pct1(s.prob)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Panel>

      {/* Meta del modelo */}
      <div className="eyebrow flex flex-wrap gap-x-4 gap-y-1 px-1">
        <span>{p.modelVersion}</span>
        <span>
          Ranking {f.home.rank} vs {f.away.rank}
        </span>
        <span>
          Forma: {p.inputs.home.played} y {p.inputs.away.played} partidos en base
        </span>
        {(p.inputs.home.hostAdvantage || p.inputs.away.hostAdvantage) && (
          <span style={{ color: "var(--accent)" }}>Bonus anfitrión aplicado</span>
        )}
      </div>
    </div>
  );
}
