// lib/data/predict.ts
// Une DB y modelo: lee equipos + fixtures, calcula forma, corre Poisson y
// guarda el payload con timestamp (histórico de predicciones).
import { db, libsql } from "@/lib/db/client";
import { predictions } from "@/lib/db/schema";
import { predictFixture } from "@/lib/model";
import { teamFormFromDb } from "./ingest";

export async function runPredictions() {
  const teamsResult = await libsql.execute("SELECT * FROM teams");
  const teamById = new Map(
    teamsResult.rows.map((r) => [
      Number(r.id),
      {
        id: Number(r.id),
        name: String(r.name),
        fifaRank: Number(r.fifa_rank),
        isHost: Number(r.is_host) === 1,
      },
    ])
  );

  const upcoming = await libsql.execute(
    "SELECT id, home_id, away_id FROM fixtures WHERE status NOT IN ('FT','AET','PEN') ORDER BY date"
  );
  console.log(`[modelo] recalculando ${upcoming.rows.length} partidos`);

  const runAt = new Date().toISOString();
  let done = 0;

  for (const row of upcoming.rows) {
    const home = teamById.get(Number(row.home_id));
    const away = teamById.get(Number(row.away_id));
    if (!home || !away) continue;

    const [homeForm, awayForm] = await Promise.all([
      teamFormFromDb(home.id),
      teamFormFromDb(away.id),
    ]);

    const payload = predictFixture(
      { fifaRank: home.fifaRank, form: homeForm, hostAdvantage: home.isHost },
      { fifaRank: away.fifaRank, form: awayForm, hostAdvantage: away.isHost }
    );

    await db.insert(predictions).values({
      fixtureId: Number(row.id),
      runAt,
      payload: JSON.stringify(payload),
    });
    done++;
  }
  console.log(`[modelo] ${done} predicciones guardadas (corrida ${runAt})`);
}
