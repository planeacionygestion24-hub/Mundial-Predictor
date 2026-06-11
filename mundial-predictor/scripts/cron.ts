// Corrida diaria: resultados nuevos -> forma actualizada -> predicciones nuevas.
// Local: pnpm cron:run. Producción: GitHub Actions (ver .github/workflows/cron.yml).
import { migrate } from "@/lib/db/migrate";
import { ingestFixturesAndTeams, ingestGroups } from "@/lib/data/ingest";
import { runPredictions } from "@/lib/data/predict";
import { runTournamentSimulation } from "@/lib/data/simulate";

async function main() {
  const start = Date.now();
  await migrate();
  await ingestFixturesAndTeams();
  await ingestGroups();
  await runPredictions();
  await runTournamentSimulation();
  console.log(`Cron completo en ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
