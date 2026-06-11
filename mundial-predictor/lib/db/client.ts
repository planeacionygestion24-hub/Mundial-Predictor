// lib/db/client.ts
// Local: file:local.db (SQLite puro, cero red). Producción: Turso vía env.
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

export const libsql = createClient({ url, authToken });
export const db = drizzle(libsql, { schema });
export { schema };
