// lib/db/client.ts
import { createClient } from "@libsql/client";
import { drizzle as drizzleLibsql } from "drizzle-orm/libsql";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Verificamos si estamos en producción en Vercel
const isProd = process.env.NODE_ENV === "production" || process.env.DATABASE_URL;

let dbInstance;

if (isProd) {
  // Configuración para la nube (Vercel Postgres)
  const queryClient = postgres(process.env.DATABASE_URL!);
  dbInstance = drizzlePostgres(queryClient, { schema });
} else {
  // Configuración para tu computadora local (SQLite)
  const url = process.env.TURSO_DATABASE_URL || "file:local.db";
  const authToken = process.env.TURSO_AUTH_TOKEN || undefined;
  const libsqlClient = createClient({ url, authToken });
  dbInstance = drizzleLibsql(libsqlClient, { schema });
}

export const db = dbInstance;
export { schema };