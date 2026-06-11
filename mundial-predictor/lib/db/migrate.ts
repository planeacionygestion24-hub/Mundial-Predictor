// lib/db/migrate.ts
// Migración idempotente con SQL crudo. La corren seed y cron antes de escribir.
import { libsql } from "./client";

export async function migrate() {
  await libsql.executeMultiple(`
    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      logo TEXT,
      group_name TEXT,
      fifa_rank INTEGER NOT NULL DEFAULT 40,
      is_host INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      round TEXT,
      home_id INTEGER NOT NULL,
      away_id INTEGER NOT NULL,
      home_goals INTEGER,
      away_goals INTEGER
    );
    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id INTEGER NOT NULL,
      run_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_predictions_fixture ON predictions (fixture_id, run_at);
    CREATE TABLE IF NOT EXISTS tournament_sims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_at TEXT NOT NULL,
      iterations INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_fixtures_date ON fixtures (date);
  `);
}
