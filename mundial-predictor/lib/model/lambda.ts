// lib/model/lambda.ts
// Goles esperados por equipo. Prior basado en ranking FIFA, mezclado con la forma
// observada en DB a medida que el torneo avanza. Constantes documentadas y editables.

/** Goles promedio por equipo por partido en mundiales recientes (~2.6 totales). */
export const MU = 1.3;
/** Sensibilidad del prior al ranking. Más alto = más diferencia entre top y fondo. */
const ALPHA = 0.35;
/** Ranking "neutro": un equipo con este ranking tiene fuerza 1.0. */
const BASE_RANK = 24;
/** Peso del prior en partidos-equivalentes. Con 6 partidos jugados, prior y forma pesan igual. */
const PRIOR_WEIGHT = 6;
/** Bonus multiplicativo de goles esperados para anfitriones (MEX/USA/CAN) jugando en casa. */
export const HOST_BONUS = 1.12;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface TeamForm {
  /** Partidos considerados (últimos N terminados). 0 si no hay data. */
  played: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface TeamInput {
  fifaRank: number;
  form: TeamForm;
  /** true si es anfitrión (México, EEUU, Canadá) y el partido es en su país. */
  hostAdvantage: boolean;
}

export interface LambdaResult {
  home: number;
  away: number;
  meta: {
    homeAttack: number;
    homeDefense: number;
    awayAttack: number;
    awayDefense: number;
  };
}

/** Fuerzas ofensiva/defensiva a priori desde el ranking FIFA. */
export function priorStrengths(fifaRank: number) {
  const rank = clamp(fifaRank, 1, 120);
  const factor = clamp(Math.pow(BASE_RANK / rank, ALPHA), 0.6, 1.7);
  return {
    attack: MU * factor, // mejores equipos marcan más
    defense: MU / factor, // mejores equipos conceden menos
  };
}

/** Mezcla bayesiana simple: prior con peso fijo, forma con peso = partidos jugados. */
export function blend(prior: number, observedPerGame: number, played: number): number {
  if (played <= 0) return prior;
  return (PRIOR_WEIGHT * prior + played * observedPerGame) / (PRIOR_WEIGHT + played);
}

/** Lambdas (goles esperados) de un partido. */
export function expectedGoals(home: TeamInput, away: TeamInput): LambdaResult {
  const hPrior = priorStrengths(home.fifaRank);
  const aPrior = priorStrengths(away.fifaRank);

  const hAttack = blend(
    hPrior.attack,
    home.form.played > 0 ? home.form.goalsFor / home.form.played : 0,
    home.form.played
  );
  const hDefense = blend(
    hPrior.defense,
    home.form.played > 0 ? home.form.goalsAgainst / home.form.played : 0,
    home.form.played
  );
  const aAttack = blend(
    aPrior.attack,
    away.form.played > 0 ? away.form.goalsFor / away.form.played : 0,
    away.form.played
  );
  const aDefense = blend(
    aPrior.defense,
    away.form.played > 0 ? away.form.goalsAgainst / away.form.played : 0,
    away.form.played
  );

  // El ataque propio se escala por la (in)defensa del rival, relativo al promedio MU.
  let lambdaHome = hAttack * (aDefense / MU);
  let lambdaAway = aAttack * (hDefense / MU);

  if (home.hostAdvantage) lambdaHome *= HOST_BONUS;
  if (away.hostAdvantage) lambdaAway *= HOST_BONUS;

  return {
    home: clamp(lambdaHome, 0.2, 4.5),
    away: clamp(lambdaAway, 0.2, 4.5),
    meta: {
      homeAttack: hAttack,
      homeDefense: hDefense,
      awayAttack: aAttack,
      awayDefense: aDefense,
    },
  };
}
