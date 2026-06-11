// lib/model/tournament.ts
// Monte Carlo del Mundial 2026. Corre el torneo completo N veces y cuenta frecuencias.
//
// Formato implementado:
// - 12 grupos (A-L) de 4. Clasifican 1° y 2° de cada grupo + los 8 mejores terceros.
// - Bracket oficial FIFA (partidos 73-104) publicado tras el sorteo de dic 2025.
// - Asignación de terceros: FIFA usa una tabla de 495 combinaciones; aquí se resuelve
//   un matching bipartito sobre los sets de grupos permitidos por llave (cada tercero
//   queda en una llave válida). Aproximación documentada: la llave exacta de cada
//   tercero puede diferir de la tabla FIFA, las probabilidades agregadas no.
// - Desempates de grupo: puntos, diferencia de gol, goles a favor, azar (FIFA sigue
//   con head-to-head y fair play; se aproximan con azar).
// - Eliminación directa: 90' Poisson; empate -> prórroga con lambda/3; empate -> penales 50/50.
import { expectedGoals, type TeamForm } from "./lambda";
import { poissonSample, type Rng, mulberry32 } from "./sample";

export type GroupLetter =
  | "A" | "B" | "C" | "D" | "E" | "F"
  | "G" | "H" | "I" | "J" | "K" | "L";

export const GROUP_LETTERS: GroupLetter[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

export interface SimTeam {
  id: number;
  name: string;
  group: GroupLetter;
  fifaRank: number;
  isHost: boolean;
  form: TeamForm;
}

export interface SimGroupFixture {
  homeId: number;
  awayId: number;
  finished: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
}

export interface TournamentInput {
  teams: SimTeam[];
  groupFixtures: SimGroupFixture[];
}

export interface TeamTournamentProbs {
  teamId: number;
  groupWinner: number;
  top2: number;
  qualified: number; // top 2 o mejor tercero (llega a dieciseisavos)
  r16: number;
  qf: number;
  sf: number;
  final: number;
  champion: number;
  /** Goles proyectados del equipo en TODO el torneo (promedio sobre simulaciones). */
  expGoals: number;
}

export interface R32Matchup {
  match: number;
  top: Array<{ homeId: number; awayId: number; prob: number }>;
}

export interface SimulationResult {
  iterations: number;
  teams: TeamTournamentProbs[];
  /** Cruces más frecuentes por llave de dieciseisavos. */
  r32Matchups: R32Matchup[];
}

// ---------------------------------------------------------------------------
// Bracket oficial 2026 (fuente: calendario FIFA post-sorteo, partidos 73-104).
type R32Slot =
  | { kind: "winner"; group: GroupLetter }
  | { kind: "runnerUp"; group: GroupLetter }
  | { kind: "third"; allowed: GroupLetter[] };

const w = (group: GroupLetter): R32Slot => ({ kind: "winner", group });
const ru = (group: GroupLetter): R32Slot => ({ kind: "runnerUp", group });
const third = (...allowed: GroupLetter[]): R32Slot => ({ kind: "third", allowed });

export const ROUND_OF_32: Array<{ match: number; home: R32Slot; away: R32Slot }> = [
  { match: 73, home: ru("A"), away: ru("B") },
  { match: 74, home: w("E"), away: third("A", "B", "C", "D", "F") },
  { match: 75, home: w("F"), away: ru("C") },
  { match: 76, home: w("C"), away: ru("F") },
  { match: 77, home: w("I"), away: third("C", "D", "F", "G", "H") },
  { match: 78, home: ru("E"), away: ru("I") },
  { match: 79, home: w("A"), away: third("C", "E", "F", "H", "I") },
  { match: 80, home: w("L"), away: third("E", "H", "I", "J", "K") },
  { match: 81, home: w("D"), away: third("B", "E", "F", "I", "J") },
  { match: 82, home: w("G"), away: third("A", "E", "H", "I", "J") },
  { match: 83, home: ru("K"), away: ru("L") },
  { match: 84, home: w("H"), away: ru("J") },
  { match: 85, home: w("B"), away: third("E", "F", "G", "I", "J") },
  { match: 86, home: w("J"), away: ru("H") },
  { match: 87, home: w("K"), away: third("D", "E", "I", "J", "L") },
  { match: 88, home: ru("D"), away: ru("G") },
];

// Rondas siguientes: cada partido toma a los ganadores de dos partidos previos.
const ROUND_OF_16: Array<[number, number, number]> = [
  // [match, fromA, fromB]
  [89, 74, 77],
  [90, 73, 75],
  [91, 76, 78],
  [92, 79, 80],
  [93, 83, 84],
  [94, 81, 82],
  [95, 86, 88],
  [96, 85, 87],
];
const QUARTERS: Array<[number, number, number]> = [
  [97, 89, 90],
  [98, 93, 94],
  [99, 91, 92],
  [100, 95, 96],
];
const SEMIS: Array<[number, number, number]> = [
  [101, 97, 98],
  [102, 99, 100],
];
const FINAL: [number, number, number] = [104, 101, 102];

/** Etiqueta corta de un slot del R32: "1°E", "2°A", "3° (A/B/C/D/F)". */
export function slotLabel(slot: R32Slot): string {
  if (slot.kind === "winner") return `1°${slot.group}`;
  if (slot.kind === "runnerUp") return `2°${slot.group}`;
  return `3° (${slot.allowed.join("/")})`;
}

// ---------------------------------------------------------------------------

interface GroupRow {
  idx: number; // índice en el array de equipos
  points: number;
  gd: number;
  gf: number;
}

function compareRows(a: GroupRow, b: GroupRow, rng: Rng): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return rng() < 0.5 ? -1 : 1;
}

/**
 * Matching bipartito tercero->llave por backtracking. Slots ordenados por menos
 * opciones primero (heurística de grado). FIFA garantiza que toda combinación de
 * 8 grupos tiene asignación válida; si algo fallara, cae a asignación libre.
 */
export function assignThirds(
  qualifiedThirdGroups: GroupLetter[],
  slots: GroupLetter[][] = ROUND_OF_32.filter((m) => m.away.kind === "third").map(
    (m) => (m.away as { kind: "third"; allowed: GroupLetter[] }).allowed
  )
): Map<number, GroupLetter> | null {
  const order = slots
    .map((allowed, slotIdx) => ({
      slotIdx,
      options: allowed.filter((g) => qualifiedThirdGroups.includes(g)),
    }))
    .sort((a, b) => a.options.length - b.options.length);

  const used = new Set<GroupLetter>();
  const assignment = new Map<number, GroupLetter>();

  function backtrack(i: number): boolean {
    if (i === order.length) return true;
    const { slotIdx, options } = order[i];
    for (const g of options) {
      if (used.has(g)) continue;
      used.add(g);
      assignment.set(slotIdx, g);
      if (backtrack(i + 1)) return true;
      used.delete(g);
      assignment.delete(slotIdx);
    }
    return false;
  }

  if (backtrack(0)) return assignment;

  // Fallback (no debería ocurrir): asignación libre en orden.
  assignment.clear();
  const remaining = [...qualifiedThirdGroups];
  for (let s = 0; s < slots.length; s++) assignment.set(s, remaining[s]);
  return assignment;
}

export function simulateTournament(
  input: TournamentInput,
  iterations = 10000,
  seed = 2026
): SimulationResult {
  const rng = mulberry32(seed);
  const teams = input.teams;
  const n = teams.length;
  const idxById = new Map(teams.map((t, i) => [t.id, i]));
  const teamsByGroup = new Map<GroupLetter, number[]>();
  for (const g of GROUP_LETTERS) teamsByGroup.set(g, []);
  teams.forEach((t, i) => teamsByGroup.get(t.group)?.push(i));

  // Lambdas de fase de grupos: no cambian entre iteraciones, se precomputan.
  const groupGames = input.groupFixtures.map((f) => {
    const hi = idxById.get(f.homeId);
    const ai = idxById.get(f.awayId);
    if (hi === undefined || ai === undefined) {
      throw new Error(`Fixture con equipo desconocido: ${f.homeId} vs ${f.awayId}`);
    }
    if (f.finished && f.homeGoals !== null && f.awayGoals !== null) {
      return { hi, ai, finished: true as const, hg: f.homeGoals, ag: f.awayGoals };
    }
    const th = teams[hi];
    const ta = teams[ai];
    const lambdas = expectedGoals(
      { fifaRank: th.fifaRank, form: th.form, hostAdvantage: th.isHost },
      { fifaRank: ta.fifaRank, form: ta.form, hostAdvantage: ta.isHost }
    );
    return { hi, ai, finished: false as const, lh: lambdas.home, la: lambdas.away };
  });

  // Contadores por equipo.
  const goals = new Float64Array(n);
  // Frecuencia de cada cruce por llave del R32: matchupCounts[i] = Map "hi:ai" -> veces.
  const matchupCounts: Array<Map<string, number>> = ROUND_OF_32.map(() => new Map());
  const counts = {
    groupWinner: new Float64Array(n),
    top2: new Float64Array(n),
    qualified: new Float64Array(n),
    r16: new Float64Array(n),
    qf: new Float64Array(n),
    sf: new Float64Array(n),
    final: new Float64Array(n),
    champion: new Float64Array(n),
  };

  // Ganador de un cruce de eliminación directa.
  function koWinner(hi: number, ai: number): number {
    const th = teams[hi];
    const ta = teams[ai];
    const l = expectedGoals(
      { fifaRank: th.fifaRank, form: th.form, hostAdvantage: th.isHost },
      { fifaRank: ta.fifaRank, form: ta.form, hostAdvantage: ta.isHost }
    );
    let hg = poissonSample(l.home, rng);
    let ag = poissonSample(l.away, rng);
    if (hg !== ag) {
      goals[hi] += hg;
      goals[ai] += ag;
      return hg > ag ? hi : ai;
    }
    // Prórroga: 30' ~ un tercio del lambda de 90'.
    hg += poissonSample(l.home / 3, rng);
    ag += poissonSample(l.away / 3, rng);
    goals[hi] += hg;
    goals[ai] += ag;
    if (hg !== ag) return hg > ag ? hi : ai;
    // Penales: empíricamente cercanos a moneda al aire.
    return rng() < 0.5 ? hi : ai;
  }

  for (let iter = 0; iter < iterations; iter++) {
    // 1. Fase de grupos
    const rows: GroupRow[] = teams.map((_, idx) => ({ idx, points: 0, gd: 0, gf: 0 }));
    for (const g of groupGames) {
      const hg = g.finished ? g.hg : poissonSample(g.lh, rng);
      const ag = g.finished ? g.ag : poissonSample(g.la, rng);
      const rh = rows[g.hi];
      const ra = rows[g.ai];
      goals[g.hi] += hg;
      goals[g.ai] += ag;
      rh.gf += hg;
      rh.gd += hg - ag;
      ra.gf += ag;
      ra.gd += ag - hg;
      if (hg > ag) rh.points += 3;
      else if (ag > hg) ra.points += 3;
      else {
        rh.points += 1;
        ra.points += 1;
      }
    }

    // 2. Posiciones por grupo
    const winnerOf = new Map<GroupLetter, number>();
    const runnerUpOf = new Map<GroupLetter, number>();
    const thirdOf = new Map<GroupLetter, GroupRow>();
    for (const g of GROUP_LETTERS) {
      const members = teamsByGroup.get(g);
      if (!members || members.length !== 4) continue;
      const table = members.map((idx) => rows[idx]).sort((a, b) => compareRows(a, b, rng));
      winnerOf.set(g, table[0].idx);
      runnerUpOf.set(g, table[1].idx);
      thirdOf.set(g, table[2]);
      counts.groupWinner[table[0].idx]++;
      counts.top2[table[0].idx]++;
      counts.top2[table[1].idx]++;
    }

    // 3. Mejores 8 terceros
    const thirdsRanked = [...thirdOf.entries()].sort((a, b) => compareRows(a[1], b[1], rng));
    const qualifiedThirds = thirdsRanked.slice(0, 8);
    const thirdGroupToIdx = new Map<GroupLetter, number>(
      qualifiedThirds.map(([g, row]) => [g, row.idx])
    );
    const thirdAssignment = assignThirds([...thirdGroupToIdx.keys()]);

    // 4. Dieciseisavos
    const winnersByMatch = new Map<number, number>();
    let thirdSlot = 0;
    for (let mIdx = 0; mIdx < ROUND_OF_32.length; mIdx++) {
      const m = ROUND_OF_32[mIdx];
      const resolve = (slot: R32Slot): number => {
        if (slot.kind === "winner") return winnerOf.get(slot.group)!;
        if (slot.kind === "runnerUp") return runnerUpOf.get(slot.group)!;
        const g = thirdAssignment!.get(thirdSlot)!;
        return thirdGroupToIdx.get(g)!;
      };
      const hi = resolve(m.home);
      const isThird = m.away.kind === "third";
      const ai = resolve(m.away);
      if (isThird) thirdSlot++;
      counts.qualified[hi]++;
      counts.qualified[ai]++;
      const key = `${hi}:${ai}`;
      const mc = matchupCounts[mIdx];
      mc.set(key, (mc.get(key) ?? 0) + 1);
      winnersByMatch.set(m.match, koWinner(hi, ai));
    }

    // 5. Octavos -> final
    const playRound = (
      round: Array<[number, number, number]>,
      counter: Float64Array
    ) => {
      for (const [match, fromA, fromB] of round) {
        const hi = winnersByMatch.get(fromA)!;
        const ai = winnersByMatch.get(fromB)!;
        counter[hi]++;
        counter[ai]++;
        winnersByMatch.set(match, koWinner(hi, ai));
      }
    };
    playRound(ROUND_OF_16, counts.r16);
    playRound(QUARTERS, counts.qf);
    playRound(SEMIS, counts.sf);
    playRound([FINAL], counts.final);
    counts.champion[winnersByMatch.get(FINAL[0])!]++;
  }

  return {
    iterations,
    teams: teams.map((t, i) => ({
      teamId: t.id,
      groupWinner: counts.groupWinner[i] / iterations,
      top2: counts.top2[i] / iterations,
      qualified: counts.qualified[i] / iterations,
      r16: counts.r16[i] / iterations,
      qf: counts.qf[i] / iterations,
      sf: counts.sf[i] / iterations,
      final: counts.final[i] / iterations,
      champion: counts.champion[i] / iterations,
      expGoals: goals[i] / iterations,
    })),
    r32Matchups: ROUND_OF_32.map((m, mIdx) => ({
      match: m.match,
      top: [...matchupCounts[mIdx].entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([key, count]) => {
          const [hi, ai] = key.split(":").map(Number);
          return { homeId: teams[hi].id, awayId: teams[ai].id, prob: count / iterations };
        }),
    })),
  };
}
