// scripts/demo.ts
// Datos de EJEMPLO: 48 equipos en 12 grupos sintéticos con los 72 partidos de fase
// de grupos. Los grupos NO son el sorteo real; sirven para ver la UI completa
// (incluido el Monte Carlo) sin API key. Para data real: pnpm seed.
import { migrate } from "@/lib/db/migrate";
import { db, libsql } from "@/lib/db/client";
import { teams, fixtures } from "@/lib/db/schema";
import { runPredictions } from "@/lib/data/predict";
import { runTournamentSimulation } from "@/lib/data/simulate";
import { rankFor, HOST_NATIONS } from "@/lib/model/ranks";
import { GROUP_LETTERS } from "@/lib/model/tournament";

// 48 selecciones plausibles repartidas en grupos sintéticos (cabeza de serie +
// tres bombos aproximados por ranking). NO es el sorteo real.
const POT1 = ["Mexico", "USA", "Canada", "Spain", "Argentina", "France", "England", "Brazil", "Portugal", "Netherlands", "Belgium", "Germany"];
const POT2 = ["Croatia", "Morocco", "Italy", "Colombia", "Uruguay", "Switzerland", "Japan", "Senegal", "Denmark", "Iran", "South Korea", "Ecuador"];
const POT3 = ["Austria", "Australia", "Ukraine", "Turkey", "Sweden", "Wales", "Serbia", "Egypt", "Panama", "Algeria", "Hungary", "Norway"];
const POT4 = ["Greece", "Ivory Coast", "Peru", "Nigeria", "Scotland", "Poland", "Venezuela", "Paraguay", "Tunisia", "Costa Rica", "Cameroon", "Chile"];

async function main() {
  await migrate();
  await libsql.executeMultiple(
    "DELETE FROM predictions; DELETE FROM fixtures; DELETE FROM teams; DELETE FROM tournament_sims;"
  );

  const idByName = new Map<string, number>();
  let teamId = 1;
  const groupMembers = new Map<string, number[]>();

  for (let g = 0; g < 12; g++) {
    const letter = GROUP_LETTERS[g];
    const members = [POT1[g], POT2[g], POT3[g], POT4[g]];
    groupMembers.set(letter, []);
    for (const name of members) {
      idByName.set(name, teamId);
      groupMembers.get(letter)!.push(teamId);
      await db.insert(teams).values({
        id: teamId,
        name,
        groupName: `Group ${letter}`,
        fifaRank: rankFor(name),
        isHost: HOST_NATIONS.has(name) ? 1 : 0,
      });
      teamId++;
    }
  }

  // Round robin de cada grupo: 6 partidos, 3 jornadas (11-27 jun).
  const PAIRINGS: Array<Array<[number, number]>> = [
    [[0, 1], [2, 3]],
    [[0, 2], [3, 1]],
    [[3, 0], [1, 2]],
  ];
  let fixtureId = 1000;
  let dayOffset = 0;
  for (const [letter, members] of groupMembers) {
    for (let j = 0; j < 3; j++) {
      for (const [h, a] of PAIRINGS[j]) {
        const day = 11 + j * 5 + (dayOffset % 5);
        await db.insert(fixtures).values({
          id: fixtureId++,
          date: `2026-06-${String(day).padStart(2, "0")}T${12 + (fixtureId % 4) * 3}:00:00-05:00`,
          status: "NS",
          round: `Grupo ${letter} (demo)`,
          homeId: members[h],
          awayId: members[a],
        });
      }
    }
    dayOffset++;
  }

  await runPredictions();
  await runTournamentSimulation(5000);
  console.log("Demo lista: 48 equipos, 72 partidos, predicciones y Monte Carlo. pnpm dev");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
