// tests/poisson.test.ts
import { describe, it, expect } from "vitest";
import { poissonPmf, scoreMatrix, marketsFromMatrix } from "@/lib/model/poisson";
import { expectedGoals, priorStrengths, blend, MU } from "@/lib/model/lambda";
import { predictFixture } from "@/lib/model";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("poissonPmf", () => {
  it("suma ~1 sobre un rango amplio de k", () => {
    const total = sum(Array.from({ length: 30 }, (_, k) => poissonPmf(2.5, k)));
    expect(total).toBeCloseTo(1, 6);
  });

  it("lambda 0 concentra toda la masa en k=0", () => {
    expect(poissonPmf(0, 0)).toBe(1);
    expect(poissonPmf(0, 3)).toBe(0);
  });
});

describe("scoreMatrix", () => {
  it("la matriz normalizada suma exactamente 1", () => {
    const m = scoreMatrix(1.6, 1.1);
    expect(sum(m.flat())).toBeCloseTo(1, 10);
  });

  it("con lambdas iguales, P(gana local) = P(gana visitante)", () => {
    const markets = marketsFromMatrix(scoreMatrix(1.3, 1.3), 1.3, 1.3);
    expect(markets.oneXTwo.home).toBeCloseTo(markets.oneXTwo.away, 10);
  });
});

describe("marketsFromMatrix", () => {
  const markets = marketsFromMatrix(scoreMatrix(1.8, 0.9), 1.8, 0.9);

  it("1X2 suma 1", () => {
    const { home, draw, away } = markets.oneXTwo;
    expect(home + draw + away).toBeCloseTo(1, 10);
  });

  it("doble oportunidad es consistente con 1X2", () => {
    expect(markets.doubleChance.homeOrDraw).toBeCloseTo(
      markets.oneXTwo.home + markets.oneXTwo.draw,
      10
    );
  });

  it("over decrece al subir la línea", () => {
    const [l15, l25, l35] = markets.totals;
    expect(l15.over).toBeGreaterThan(l25.over);
    expect(l25.over).toBeGreaterThan(l35.over);
    expect(l15.over + l15.under).toBeCloseTo(1, 10);
  });

  it("más goles esperados implica más over 2.5", () => {
    const low = marketsFromMatrix(scoreMatrix(0.9, 0.8), 0.9, 0.8);
    const high = marketsFromMatrix(scoreMatrix(2.2, 1.6), 2.2, 1.6);
    expect(high.totals[1].over).toBeGreaterThan(low.totals[1].over);
  });

  it("BTTS coincide con 1 - P(local 0) - P(visita 0) + P(0-0)", () => {
    const m = scoreMatrix(1.8, 0.9);
    const pHome0 = sum(m[0]);
    const pAway0 = sum(m.map((row) => row[0]));
    const expected = 1 - pHome0 - pAway0 + m[0][0];
    expect(markets.btts.yes).toBeCloseTo(expected, 10);
  });

  it("top de marcadores viene ordenado descendente", () => {
    for (let i = 1; i < markets.exactScores.length; i++) {
      expect(markets.exactScores[i - 1].prob).toBeGreaterThanOrEqual(
        markets.exactScores[i].prob
      );
    }
  });
});

describe("lambda", () => {
  it("mejor ranking implica más ataque y menos goles concedidos", () => {
    const top = priorStrengths(1);
    const mid = priorStrengths(24);
    const low = priorStrengths(80);
    expect(top.attack).toBeGreaterThan(mid.attack);
    expect(mid.attack).toBeGreaterThan(low.attack);
    expect(top.defense).toBeLessThan(low.defense);
    expect(mid.attack).toBeCloseTo(MU, 6);
  });

  it("sin partidos jugados, blend devuelve el prior", () => {
    expect(blend(1.4, 0, 0)).toBe(1.4);
  });

  it("la forma observada mueve el blend hacia ella", () => {
    const blended = blend(1.0, 3.0, 6);
    expect(blended).toBeGreaterThan(1.0);
    expect(blended).toBeLessThan(3.0);
  });

  it("el favorito tiene más goles esperados", () => {
    const noForm = { played: 0, goalsFor: 0, goalsAgainst: 0 };
    const r = expectedGoals(
      { fifaRank: 2, form: noForm, hostAdvantage: false },
      { fifaRank: 60, form: noForm, hostAdvantage: false }
    );
    expect(r.home).toBeGreaterThan(r.away);
  });

  it("la ventaja de anfitrión sube el lambda propio", () => {
    const noForm = { played: 0, goalsFor: 0, goalsAgainst: 0 };
    const neutral = expectedGoals(
      { fifaRank: 15, form: noForm, hostAdvantage: false },
      { fifaRank: 15, form: noForm, hostAdvantage: false }
    );
    const host = expectedGoals(
      { fifaRank: 15, form: noForm, hostAdvantage: true },
      { fifaRank: 15, form: noForm, hostAdvantage: false }
    );
    expect(host.home).toBeGreaterThan(neutral.home);
    expect(host.away).toBeCloseTo(neutral.away, 10);
  });
});

describe("predictFixture", () => {
  it("payload completo y coherente para un cruce desigual", () => {
    const p = predictFixture(
      { fifaRank: 2, form: { played: 5, goalsFor: 12, goalsAgainst: 3 }, hostAdvantage: false },
      { fifaRank: 55, form: { played: 5, goalsFor: 4, goalsAgainst: 9 }, hostAdvantage: false }
    );
    expect(p.markets.oneXTwo.home).toBeGreaterThan(0.5);
    expect(p.matrix.length).toBe(7);
    expect(p.matrix[0].length).toBe(7);
    expect(p.lambdas.home).toBeGreaterThan(p.lambdas.away);
    expect(p.modelVersion).toBe("poisson-v1");
  });
});
