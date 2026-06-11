import { migrate } from "@/lib/db/migrate";

migrate().then(() => {
  console.log("Tablas listas.");
  process.exit(0);
});
