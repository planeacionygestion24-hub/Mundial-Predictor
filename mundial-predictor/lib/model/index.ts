// lib/model/index.ts
import { expectedGoals, type TeamInput } from "./lambda";
import { marketsFromMatrix, scoreMatrix, type Markets } from "./poisson";

export type { Markets, ExactScore, TotalsLine } from "./poisson";
export type { TeamInput, TeamForm } from "./lambda";
export { expectedGoals, priorStrengths, blend, MU, HOST_BONUS } from "./lambda";
export { poissonPmf, scoreMatrix, marketsFromMatrix } from "./poisson";

export interface PredictionPayload {
  markets: Markets;
  /** Matriz 7x7 (0..6 goles) para el heatmap de la UI. */
  matrix: number[][];
  lambdas: { home: number; away: number };
  inputs: {
    home: { rank: number; played: number; hostAdvantage: boolean };
    away: { rank: number; played: number; hostAdvantage: boolean };
  };
  modelVersion: string;
}

export const MODEL_VERSION = "poisson-v1";

export function predictFixture(home: TeamInput, away: TeamInput): PredictionPayload {
  const lambdas = expectedGoals(home, away);
  const fullMatrix = scoreMatrix(lambdas.home, lambdas.away, 10);
  const markets = marketsFromMatrix(fullMatrix, lambdas.home, lambdas.away);
  // Para la UI guardamos solo 0..6: cubre >99% de la masa y mantiene el payload chico.
  const matrix = fullMatrix.slice(0, 7).map((row) => row.slice(0, 7));
  return {
    markets,
    matrix,
    lambdas: { home: lambdas.home, away: lambdas.away },
    inputs: {
      home: { rank: home.fifaRank, played: home.form.played, hostAdvantage: home.hostAdvantage },
      away: { rank: away.fifaRank, played: away.form.played, hostAdvantage: away.hostAdvantage },
    },
    modelVersion: MODEL_VERSION,
  };
}
