// lib/data/ingest.ts
// Capa de ingesta: trae de API-Football y normaliza a DB. El modelo nunca toca
// este archivo; solo lee lo que queda en SQLite/Turso.
import { db, libsql } from "@/lib/db/client";
import { teams, fixtures } from "@/lib/db/schema";
import { fetchFixtures, fetchStandings, type ApiFixture } from "./apiFootball";
import { rankFor, HOST_NATIONS } from "@/lib/model/ranks";

/** Estados de API-Football que cuentan como partido terminado. */
export const FINISHED = new Set(["FT", "AET", "PEN"]);

export async function ingestFixturesAndTeams() {
  const apiFixtures = await fetchFixtures();
  console.log(`[ingesta] ${apiFixtures.length} fixtures recibidos`);

  const seenTeams = new Map<number, { id: number; name: string; logo: string }>();
  for (const f of apiFixtures) {
    seenTeams.set(f.teams.home.id, f.teams.home);
    seenTeams.set(f.teams.away.id, f.teams.away);
  }

  for (const t of seenTeams.values()) {
    await db
      .insert(teams)
      .values({
        id: t.id,
        name: t.name,
        logo: t.logo,
        fifaRank: rankFor(t.name),
        isHost: HOST_NATIONS.has(t.name) ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: teams.id,
        set: { name: t.name, logo: t.logo, fifaRank: rankFor(t.name) },
      });
  }
  console.log(`[ingesta] ${seenTeams.size} equipos upserted`);

  for (const f of apiFixtures) {
    await db
      .insert(fixtures)
      .values(fixtureRow(f))
      .onConflictDoUpdate({ target: fixtures.id, set: fixtureRow(f) });
  }
  console.log(`[ingesta] fixtures upserted`);
}

function fixtureRow(f: ApiFixture) {
  return {
    id: f.fixture.id,
    date: f.fixture.date,
    status: f.fixture.status.short,
    round: f.league.round,
    homeId: f.teams.home.id,
    awayId: f.teams.away.id,
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
  };
}

export async function ingestGroups() {
  const standings = await fetchStandings();
  let updated = 0;
  for (const entry of standings) {
    for (const group of entry.league.standings) {
      for (const row of group) {
        await libsql.execute({
          sql: "UPDATE teams SET group_name = ? WHERE id = ?",
          args: [row.group, row.team.id],
        });
        updated++;
      }
    }
  }
  console.log(`[ingesta] grupos asignados a ${updated} equipos`);
}

/** Forma de un equipo desde la DB: últimos N partidos terminados. */
export async function teamFormFromDb(teamId: number, lastN = 10) {
  const result = await libsql.execute({
    sql: `
      SELECT home_id, away_id, home_goals, away_goals
      FROM fixtures
      WHERE (home_id = ? OR away_id = ?)
        AND status IN ('FT','AET','PEN')
        AND home_goals IS NOT NULL
      ORDER BY date DESC
      LIMIT ?
    `,
    args: [teamId, teamId, lastN],
  });
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const row of result.rows) {
    const isHome = Number(row.home_id) === teamId;
    goalsFor += Number(isHome ? row.home_goals : row.away_goals);
    goalsAgainst += Number(isHome ? row.away_goals : row.home_goals);
  }
  return { played: result.rows.length, goalsFor, goalsAgainst };
}
