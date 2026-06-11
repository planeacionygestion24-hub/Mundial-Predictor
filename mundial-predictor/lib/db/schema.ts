// lib/db/schema.ts
import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const teams = sqliteTable("teams", {
  id: integer("id").primaryKey(), // id de API-Football
  name: text("name").notNull(),
  code: text("code"),
  logo: text("logo"),
  groupName: text("group_name"),
  fifaRank: integer("fifa_rank").notNull().default(40),
  isHost: integer("is_host").notNull().default(0),
});

export const fixtures = sqliteTable("fixtures", {
  id: integer("id").primaryKey(), // id de API-Football
  date: text("date").notNull(), // ISO
  status: text("status").notNull(), // NS, FT, etc. (short code de API-Football)
  round: text("round"),
  homeId: integer("home_id").notNull(),
  awayId: integer("away_id").notNull(),
  homeGoals: integer("home_goals"),
  awayGoals: integer("away_goals"),
});

export const predictions = sqliteTable("predictions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  fixtureId: integer("fixture_id").notNull(),
  runAt: text("run_at").notNull(), // ISO timestamp de la corrida
  payload: text("payload").notNull(), // JSON: PredictionPayload
});

export type Team = typeof teams.$inferSelect;
export type Fixture = typeof fixtures.$inferSelect;
export type Prediction = typeof predictions.$inferSelect;
