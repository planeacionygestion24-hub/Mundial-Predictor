// Firma visual de la app: grilla de calor de marcadores exactos 0..6 x 0..6.
// Intensidad ámbar proporcional a la probabilidad; el marcador más probable
// queda resaltado con borde.
import { pct1 } from "@/lib/format";

export function HeatGrid({
  matrix,
  homeName,
  awayName,
}: {
  matrix: number[][];
  homeName: string;
  awayName: string;
}) {
  const max = Math.max(...matrix.flat());
  let best: [number, number] = [0, 0];
  matrix.forEach((row, h) =>
    row.forEach((p, a) => {
      if (p === matrix[best[0]][best[1]] && h === best[0] && a === best[1]) return;
      if (p > matrix[best[0]][best[1]]) best = [h, a];
    })
  );

  return (
    <div className="mono text-[11px]">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="eyebrow">{homeName} (filas)</span>
        <span className="eyebrow">{awayName} (columnas)</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `28px repeat(7, 1fr)` }}>
        <div />
        {Array.from({ length: 7 }, (_, a) => (
          <div key={`h-${a}`} className="pb-1 text-center" style={{ color: "var(--muted)" }}>
            {a}
          </div>
        ))}
        {matrix.map((row, h) => (
          <Row key={h} h={h} row={row} max={max} best={best} />
        ))}
      </div>
    </div>
  );
}

function Row({
  h,
  row,
  max,
  best,
}: {
  h: number;
  row: number[];
  max: number;
  best: [number, number];
}) {
  return (
    <>
      <div className="flex items-center" style={{ color: "var(--muted)" }}>
        {h}
      </div>
      {row.map((p, a) => {
        const intensity = max > 0 ? p / max : 0;
        const isBest = h === best[0] && a === best[1];
        return (
          <div
            key={a}
            title={`${h}-${a}: ${pct1(p)}%`}
            className="m-px flex aspect-square items-center justify-center"
            style={{
              background: `rgba(255, 196, 0, ${0.04 + intensity * 0.85})`,
              color: intensity > 0.45 ? "#000" : "var(--muted)",
              outline: isBest ? "1px solid var(--accent)" : "none",
              fontWeight: isBest ? 600 : 400,
            }}
          >
            {p >= 0.01 ? Math.round(p * 100) : ""}
          </div>
        );
      })}
    </>
  );
}
