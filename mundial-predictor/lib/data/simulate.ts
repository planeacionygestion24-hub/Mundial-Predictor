// lib/data/simulate.ts
// Une DB y Monte Carlo: arma el input del torneo, corre N iteraciones y guarda
// el resultado con timestamp en tournament_sims.
import { libsql } from "@/lib/db/client";
import { teamFormFromDb, FINISHED } from "./ingest";
import {
  simulateTournament,
  slotLabel,
  GROUP_LETTERS,
  ROUND_OF_32,
  type GroupLetter,
  type SimTeam,
  type SimGroupFixture,
} from "@/lib/model/tournament";

export interface StoredSimTeam {
  teamId: number;
  name: string;
  group: GroupLetter;
  fifaRank: number;
  groupWinner: number;
  top2: number;
  qualified: number;
  r16: number;
  qf: number;
  sf: number;
  final: number;
  champion: number;
  expGoals: number;
}

export interface StoredR32Matchup {
  match: number;
  homeSlot: string; // "1°E", "2°A", "3° (A/B/C/D/F)"
  awaySlot: string;
  top: Array<{ home: string; away: string; prob: number }>;
}

export interface StoredSimulation {
  runAt: string;
  iterations: number;
  teams: StoredSimTeam[];
  r32Matchups?: StoredR32Matchup[];
}

/** "Group A" -> "A". Devuelve null si el nombre no termina en letra de grupo válida. */
function groupLetter(groupName: string | null): GroupLetter | null {
  if (!groupName) return null;
  const letter = groupName.trim().slice(-1).toUpperCase();
  return (GROUP_LETTERS as string[]).includes(letter) ? (letter as GroupLetter) : null;
}

export async function runTournamentSimulation(iterations?: number) {
  const iters = iterations ?? Number(process.env.MC_ITERATIONS ?? 10000);

  const teamRows = await libsql.execute("SELECT * FROM teams");
  const simTeams: SimTeam[] = [];
  for (const r of teamRows.rows) {
    const group = groupLetter(r.group_name === null ? null : String(r.group_name));
    if (!group) continue;
    simTeams.push({
      id: Number(r.id),
      name: String(r.name),
      group,
      fifaRank: Number(r.fifa_rank),
      isHost: Number(r.is_host) === 1,
      form: await teamFormFromDb(Number(r.id)),
    });
  }

  // Validación del formato: 12 grupos de 4. Si la data no está completa
  // (p. ej. standings aún no cargados), no simular con un torneo a medias.
  const byGroup = new Map<GroupLetter, number>();
  for (const t of simTeams) byGroup.set(t.group, (byGroup.get(t.group) ?? 0) + 1);
  const complete =
    simTeams.length === 48 && GROUP_LETTERS.every((g) => byGroup.get(g) === 4);
  if (!complete) {
    console.warn(
      `[montecarlo] torneo incompleto en DB (${simTeams.length} equipos con grupo). Se omite la simulación.`
    );
    return null;
  }

  // Solo partidos de fase de grupos: ambos equipos del mismo grupo.
  const groupOf = new Map(simTeams.map((t) => [t.id, t.group]));
  const fixtureRows = await libsql.execute(
    "SELECT id, status, home_id, away_id, home_goals, away_goals FROM fixtures"
  );
  const groupFixtures: SimGroupFixture[] = [];
  for (const r of fixtureRows.rows) {
    const homeId = Number(r.home_id);
    const awayId = Number(r.away_id);
    const gh = groupOf.get(homeId);
    const ga = groupOf.get(awayId);
    if (!gh || !ga || gh !== ga) continue;
    groupFixtures.push({
      homeId,
      awayId,
      finished: FINISHED.has(String(r.status)) && r.home_goals !== null,
      homeGoals: r.home_goals === null ? null : Number(r.home_goals),
      awayGoals: r.away_goals === null ? null : Number(r.away_goals),
    });
  }
  if (groupFixtures.length !== 72) {
    console.warn(
      `[montecarlo] se esperaban 72 partidos de grupos, hay ${groupFixtures.length}. Se simula igual.`
    );
  }

  console.log(`[montecarlo] ${iters} iteraciones sobre ${simTeams.length} equipos...`);
  const start = Date.now();
  const result = simulateTournament(
    { teams: simTeams, groupFixtures },
    iters,
    Date.now() % 2 ** 31 // seed distinta por corrida; en tests se pasa fija
  );
  console.log(`[montecarlo] listo en ${((Date.now() - start) / 1000).toFixed(1)}s`);

  const teamMeta = new Map(simTeams.map((t) => [t.id, t]));
  const nameOf = (id: number) => teamMeta.get(id)?.name ?? `#${id}`;
  const stored: StoredSimulation = {
    runAt: new Date().toISOString(),
    iterations: iters,
    teams: result.teams
      .map((t) => {
        const meta = teamMeta.get(t.teamId)!;
        return {
          ...t,
          name: meta.name,
          group: meta.group,
          fifaRank: meta.fifaRank,
        };
      })
      .sort((a, b) => b.champion - a.champion),
    r32Matchups: result.r32Matchups.map((m, i) => ({
      match: m.match,
      homeSlot: slotLabel(ROUND_OF_32[i].home),
      awaySlot: slotLabel(ROUND_OF_32[i].away),
      top: m.top.map((p) => ({
        home: nameOf(p.homeId),
        away: nameOf(p.awayId),
        prob: p.prob,
      })),
    })),
  };

  await libsql.execute({
    sql: "INSERT INTO tournament_sims (run_at, iterations, payload) VALUES (?, ?, ?)",
    args: [stored.runAt, iters, JSON.stringify(stored)],
  });
  console.log(`[montecarlo] simulación guardada (${stored.runAt})`);
  return stored;
}

export async function latestSimulation(): Promise<StoredSimulation | null> {
  const result = await libsql.execute(
    "SELECT payload FROM tournament_sims ORDER BY id DESC LIMIT 1"
  );
  if (result.rows.length === 0) return null;
  return JSON.parse(String(result.rows[0].payload)) as StoredSimulation;
}
