// Seed real: requiere APIFOOTBALL_KEY. Consume ~2 requests (fixtures + standings).
import { migrate } from "@/lib/db/migrate";
import { ingestFixturesAndTeams, ingestGroups } from "@/lib/data/ingest";
import { runPredictions } from "@/lib/data/predict";
import { runTournamentSimulation } from "@/lib/data/simulate";

async function main() {
  await migrate();
  await ingestFixturesAndTeams();
  await ingestGroups();
  await runPredictions();
  await runTournamentSimulation();
  console.log("Seed completo. Corre pnpm dev y abre localhost:3000");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
