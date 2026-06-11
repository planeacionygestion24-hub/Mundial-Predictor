// lib/data/queries.ts
// Lecturas de la UI. Solo SELECT; nada de red.
import { libsql } from "@/lib/db/client";
import type { PredictionPayload } from "@/lib/model";

export interface FixtureView {
  id: number;
  date: string;
  status: string;
  round: string | null;
  home: { id: number; name: string; group: string | null; rank: number };
  away: { id: number; name: string; group: string | null; rank: number };
  prediction: PredictionPayload | null;
  runAt: string | null;
}

const BASE_SELECT = `
  SELECT
    f.id, f.date, f.status, f.round,
    th.id AS home_id, th.name AS home_name, th.group_name AS home_group, th.fifa_rank AS home_rank,
    ta.id AS away_id, ta.name AS away_name, ta.group_name AS away_group, ta.fifa_rank AS away_rank,
    p.payload AS payload, p.run_at AS run_at
  FROM fixtures f
  JOIN teams th ON th.id = f.home_id
  JOIN teams ta ON ta.id = f.away_id
  LEFT JOIN (
    SELECT pr.fixture_id, pr.payload, pr.run_at
    FROM predictions pr
    JOIN (SELECT fixture_id, MAX(id) AS max_id FROM predictions GROUP BY fixture_id) last
      ON pr.id = last.max_id
  ) p ON p.fixture_id = f.id
`;

function rowToView(row: Record<string, unknown>): FixtureView {
  return {
    id: Number(row.id),
    date: String(row.date),
    status: String(row.status),
    round: row.round === null ? null : String(row.round),
    home: {
      id: Number(row.home_id),
      name: String(row.home_name),
      group: row.home_group === null ? null : String(row.home_group),
      rank: Number(row.home_rank),
    },
    away: {
      id: Number(row.away_id),
      name: String(row.away_name),
      group: row.away_group === null ? null : String(row.away_group),
      rank: Number(row.away_rank),
    },
    prediction: row.payload
      ? (JSON.parse(String(row.payload)) as PredictionPayload)
      : null,
    runAt: row.run_at === null || row.run_at === undefined ? null : String(row.run_at),
  };
}

export async function upcomingFixtures(limit = 24): Promise<FixtureView[]> {
  const result = await libsql.execute({
    sql: `${BASE_SELECT}
      WHERE f.status NOT IN ('FT','AET','PEN')
      ORDER BY f.date ASC
      LIMIT ?`,
    args: [limit],
  });
  return result.rows.map((r) => rowToView(r as Record<string, unknown>));
}

export async function fixtureById(id: number): Promise<FixtureView | null> {
  const result = await libsql.execute({
    sql: `${BASE_SELECT} WHERE f.id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return null;
  return rowToView(result.rows[0] as Record<string, unknown>);
}
