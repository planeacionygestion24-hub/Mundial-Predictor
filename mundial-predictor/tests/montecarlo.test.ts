// tests/montecarlo.test.ts
import { describe, it, expect } from "vitest";
import {
  simulateTournament,
  assignThirds,
  GROUP_LETTERS,
  type SimTeam,
  type SimGroupFixture,
  type GroupLetter,
} from "@/lib/model/tournament";

const noForm = { played: 0, goalsFor: 0, goalsAgainst: 0 };

/** Torneo sintético: 48 equipos, ranking 1..48, 12 grupos balanceados, 72 partidos. */
function buildInput(): { teams: SimTeam[]; groupFixtures: SimGroupFixture[] } {
  const teams: SimTeam[] = [];
  let id = 1;
  for (let g = 0; g < 12; g++) {
    for (let slot = 0; slot < 4; slot++) {
      // Bombos: ranking g+1, g+13, g+25, g+37 -> grupos parejos entre sí.
      teams.push({
        id: id++,
        name: `T${id}`,
        group: GROUP_LETTERS[g],
        fifaRank: g + 1 + slot * 12,
        isHost: false,
        form: noForm,
      });
    }
  }
  const groupFixtures: SimGroupFixture[] = [];
  const PAIRINGS: Array<[number, number]> = [
    [0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2],
  ];
  for (let g = 0; g < 12; g++) {
    const base = g * 4;
    for (const [h, a] of PAIRINGS) {
      groupFixtures.push({
        homeId: teams[base + h].id,
        awayId: teams[base + a].id,
        finished: false,
        homeGoals: null,
        awayGoals: null,
      });
    }
  }
  return { teams, groupFixtures };
}

describe("simulateTournament", () => {
  const input = buildInput();
  const result = simulateTournament(input, 3000, 42);
  const byId = new Map(result.teams.map((t) => [t.teamId, t]));

  it("la probabilidad de campeón suma 1", () => {
    const total = result.teams.reduce((s, t) => s + t.champion, 0);
    expect(total).toBeCloseTo(1, 8);
  });

  it("clasifican exactamente 32 equipos por iteración", () => {
    const total = result.teams.reduce((s, t) => s + t.qualified, 0);
    expect(total).toBeCloseTo(32, 8);
  });

  it("hay exactamente 12 ganadores de grupo y 24 top2 por iteración", () => {
    expect(result.teams.reduce((s, t) => s + t.groupWinner, 0)).toBeCloseTo(12, 8);
    expect(result.teams.reduce((s, t) => s + t.top2, 0)).toBeCloseTo(24, 8);
  });

  it("las rondas se reducen a la mitad: 16 en octavos, 8 en cuartos, 4 en semis, 2 en final", () => {
    expect(result.teams.reduce((s, t) => s + t.r16, 0)).toBeCloseTo(16, 8);
    expect(result.teams.reduce((s, t) => s + t.qf, 0)).toBeCloseTo(8, 8);
    expect(result.teams.reduce((s, t) => s + t.sf, 0)).toBeCloseTo(4, 8);
    expect(result.teams.reduce((s, t) => s + t.final, 0)).toBeCloseTo(2, 8);
  });

  it("el ranking 1 es campeón más veces que el ranking 48 y clasifica más", () => {
    const top = byId.get(1)!; // rank 1
    const bottom = byId.get(48)!; // rank 48
    expect(top.champion).toBeGreaterThan(bottom.champion);
    expect(top.qualified).toBeGreaterThan(bottom.qualified);
    expect(top.groupWinner).toBeGreaterThan(0.4);
  });

  it("la cadena de rondas es monótona: campeón <= final <= semis <= cuartos", () => {
    for (const t of result.teams) {
      expect(t.champion).toBeLessThanOrEqual(t.final + 1e-9);
      expect(t.final).toBeLessThanOrEqual(t.sf + 1e-9);
      expect(t.sf).toBeLessThanOrEqual(t.qf + 1e-9);
      expect(t.qf).toBeLessThanOrEqual(t.r16 + 1e-9);
      expect(t.r16).toBeLessThanOrEqual(t.qualified + 1e-9);
    }
  });

  it("respeta resultados ya jugados: grupo A decidido a mano", () => {
    const forced = buildInput();
    // Equipo 4 (el peor del grupo A) gana sus 3 partidos 1-0; el resto del grupo empata 0-0.
    for (const f of forced.groupFixtures) {
      const inGroupA = f.homeId <= 4 && f.awayId <= 4;
      if (!inGroupA) continue;
      f.finished = true;
      if (f.homeId === 4) {
        f.homeGoals = 1;
        f.awayGoals = 0;
      } else if (f.awayId === 4) {
        f.homeGoals = 0;
        f.awayGoals = 1;
      } else {
        f.homeGoals = 0;
        f.awayGoals = 0;
      }
    }
    const r = simulateTournament(forced, 500, 7);
    const team4 = r.teams.find((t) => t.teamId === 4)!;
    expect(team4.groupWinner).toBe(1);
    expect(team4.qualified).toBe(1);
  });
});

describe("assignThirds", () => {
  it("asigna 8 terceros a llaves válidas", () => {
    const qualified: GroupLetter[] = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const assignment = assignThirds(qualified);
    expect(assignment).not.toBeNull();
    expect(assignment!.size).toBe(8);
    const used = new Set(assignment!.values());
    expect(used.size).toBe(8);
  });

  it("encuentra matching para combinaciones difíciles (sin A ni B)", () => {
    const qualified: GroupLetter[] = ["C", "D", "E", "F", "I", "J", "K", "L"];
    const assignment = assignThirds(qualified)!;
    const used = new Set(assignment.values());
    expect(used.size).toBe(8);
    for (const g of qualified) expect(used.has(g)).toBe(true);
  });

  it("toda combinación aleatoria de 8 grupos obtiene matching completo", () => {
    // Muestreo de combinaciones (no las 495, suficiente para confianza).
    for (let trial = 0; trial < 60; trial++) {
      const shuffled = [...GROUP_LETTERS].sort(() => Math.sin(trial * 999 + 1) - 0.3);
      const qualified = shuffled.slice(0, 8);
      const assignment = assignThirds(qualified)!;
      expect(new Set(assignment.values()).size).toBe(8);
    }
  });
});

describe("extensiones: goles proyectados y cruces del R32", () => {
  const input = buildInput();
  const result = simulateTournament(input, 2000, 99);
  const byId = new Map(result.teams.map((t) => [t.teamId, t]));

  it("expGoals es positivo y el mejor ranking proyecta más goles que el peor", () => {
    for (const t of result.teams) expect(t.expGoals).toBeGreaterThan(0);
    expect(byId.get(1)!.expGoals).toBeGreaterThan(byId.get(48)!.expGoals);
  });

  it("hay 16 llaves de R32 con cruces y probabilidades ordenadas", () => {
    expect(result.r32Matchups.length).toBe(16);
    for (const m of result.r32Matchups) {
      expect(m.top.length).toBeGreaterThan(0);
      const total = m.top.reduce((s, p) => s + p.prob, 0);
      expect(total).toBeLessThanOrEqual(1 + 1e-9);
      for (let i = 1; i < m.top.length; i++) {
        expect(m.top[i - 1].prob).toBeGreaterThanOrEqual(m.top[i].prob);
      }
    }
  });

  it("el partido 73 siempre cruza al 2° del grupo A contra el 2° del grupo B", () => {
    const groupOf = new Map(input.teams.map((t) => [t.id, t.group]));
    const m73 = result.r32Matchups.find((m) => m.match === 73)!;
    for (const pair of m73.top) {
      expect(groupOf.get(pair.homeId)).toBe("A");
      expect(groupOf.get(pair.awayId)).toBe("B");
    }
  });

  it("los goles proyectados del torneo son consistentes: total > 72 partidos x 2 goles", () => {
    // 72 de grupos + 31 de eliminación: con MU=1.3 por equipo, el total ronda 250-280.
    const total = result.teams.reduce((s, t) => s + t.expGoals, 0);
    expect(total).toBeGreaterThan(180);
    expect(total).toBeLessThan(400);
  });
});
