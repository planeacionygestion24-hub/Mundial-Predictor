// lib/model/poisson.ts
// Matemática pura. Sin red, sin DB. Todo lo de este archivo es testeable en aislamiento.

export interface ExactScore {
  home: number;
  away: number;
  prob: number;
}

export interface TotalsLine {
  line: number;
  over: number;
  under: number;
}

export interface Markets {
  oneXTwo: { home: number; draw: number; away: number };
  doubleChance: { homeOrDraw: number; homeOrAway: number; drawOrAway: number };
  totals: TotalsLine[];
  btts: { yes: number; no: number };
  exactScores: ExactScore[]; // top 5, ordenados por probabilidad
  cleanSheet: { home: number; away: number };
  winToNil: { home: number; away: number };
  expectedGoals: { home: number; away: number; total: number };
}

/** P(X = k) para X ~ Poisson(lambda). Iterativo para evitar overflow de factorial. */
export function poissonPmf(lambda: number, k: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

/**
 * Matriz de probabilidad de marcadores exactos asumiendo goles independientes
 * Poisson(lambdaHome) x Poisson(lambdaAway). matrix[h][a] = P(marcador h-a).
 * Se normaliza para repartir la masa de la cola (>maxGoals) y que la matriz sume 1.
 */
export function scoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  maxGoals = 10
): number[][] {
  const homePmf: number[] = [];
  const awayPmf: number[] = [];
  for (let k = 0; k <= maxGoals; k++) {
    homePmf[k] = poissonPmf(lambdaHome, k);
    awayPmf[k] = poissonPmf(lambdaAway, k);
  }
  const matrix: number[][] = [];
  let total = 0;
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] = homePmf[h] * awayPmf[a];
      total += matrix[h][a];
    }
  }
  return matrix.map((row) => row.map((v) => v / total));
}

/** Deriva todos los mercados del slice desde una matriz de marcadores. */
export function marketsFromMatrix(
  matrix: number[][],
  lambdaHome: number,
  lambdaAway: number,
  lines: number[] = [1.5, 2.5, 3.5]
): Markets {
  const size = matrix.length;
  let home = 0;
  let draw = 0;
  let away = 0;
  let btts = 0;
  let csHome = 0; // visitante no marca
  let csAway = 0; // local no marca
  let wtnHome = 0;
  let wtnAway = 0;
  const overByLine = new Map<number, number>(lines.map((l) => [l, 0]));
  const scores: ExactScore[] = [];

  for (let h = 0; h < size; h++) {
    for (let a = 0; a < size; a++) {
      const p = matrix[h][a];
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
      if (h >= 1 && a >= 1) btts += p;
      if (a === 0) {
        csHome += p;
        if (h > 0) wtnHome += p;
      }
      if (h === 0) {
        csAway += p;
        if (a > 0) wtnAway += p;
      }
      for (const line of lines) {
        if (h + a > line) overByLine.set(line, (overByLine.get(line) ?? 0) + p);
      }
      scores.push({ home: h, away: a, prob: p });
    }
  }

  scores.sort((x, y) => y.prob - x.prob);

  return {
    oneXTwo: { home, draw, away },
    doubleChance: {
      homeOrDraw: home + draw,
      homeOrAway: home + away,
      drawOrAway: draw + away,
    },
    totals: lines.map((line) => {
      const over = overByLine.get(line) ?? 0;
      return { line, over, under: 1 - over };
    }),
    btts: { yes: btts, no: 1 - btts },
    exactScores: scores.slice(0, 5),
    cleanSheet: { home: csHome, away: csAway },
    winToNil: { home: wtnHome, away: wtnAway },
    expectedGoals: {
      home: lambdaHome,
      away: lambdaAway,
      total: lambdaHome + lambdaAway,
    },
  };
}
