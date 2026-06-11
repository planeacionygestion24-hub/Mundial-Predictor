// lib/data/apiFootball.ts
// Cliente directo a v3.football.api-sports.io (NO RapidAPI).
// Cache a disco obligatorio: cada respuesta se guarda en .cache/api y se reusa
// dentro de su TTL. Esto protege los 100 requests/día del plan free durante
// desarrollo. API_CACHE=off lo desactiva.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://v3.football.api-sports.io";
const CACHE_DIR = join(process.cwd(), ".cache", "api");

export const LEAGUE = Number(process.env.APIFOOTBALL_LEAGUE ?? 1); // World Cup
export const SEASON = Number(process.env.APIFOOTBALL_SEASON ?? 2026);

interface ApiResponse<T> {
  response: T;
  errors: unknown;
  results: number;
}

function cachePath(endpoint: string, params: Record<string, string | number>) {
  const key = createHash("sha1")
    .update(endpoint + JSON.stringify(params))
    .digest("hex");
  return join(CACHE_DIR, `${endpoint.replace(/\//g, "_")}-${key}.json`);
}

async function rawFetch<T>(
  endpoint: string,
  params: Record<string, string | number>
): Promise<ApiResponse<T>> {
  const key = process.env.APIFOOTBALL_KEY;
  if (!key) {
    throw new Error(
      "Falta APIFOOTBALL_KEY en el entorno. Copia .env.example a .env.local y pon tu key de api-sports.io"
    );
  }
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  );
  const url = `${BASE}${endpoint}?${qs}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "x-apisports-key": key } });
      const remaining = res.headers.get("x-ratelimit-requests-remaining");
      if (remaining !== null) {
        console.log(`[api] ${endpoint} -> quota restante hoy: ${remaining}`);
        if (Number(remaining) < 10) {
          console.warn("[api] ALERTA: quedan menos de 10 requests del día.");
        }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${endpoint}`);
      const json = (await res.json()) as ApiResponse<T>;
      const errs = json.errors;
      if (errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs).length > 0)) {
        throw new Error(`API-Football devolvió errores: ${JSON.stringify(errs)}`);
      }
      return json;
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        const wait = attempt * 1500;
        console.warn(`[api] intento ${attempt} falló, reintento en ${wait}ms`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

/**
 * GET con cache a disco. ttlMinutes controla la frescura por tipo de dato:
 * fixtures cambian a diario, squads casi nunca.
 */
export async function apiGet<T>(
  endpoint: string,
  params: Record<string, string | number>,
  ttlMinutes = 60 * 12
): Promise<T> {
  const useCache = (process.env.API_CACHE ?? "on") !== "off";
  const file = cachePath(endpoint, params);

  if (useCache && existsSync(file)) {
    const ageMin = (Date.now() - statSync(file).mtimeMs) / 60000;
    if (ageMin < ttlMinutes) {
      const cached = JSON.parse(readFileSync(file, "utf-8")) as ApiResponse<T>;
      console.log(`[cache] ${endpoint} (${Math.round(ageMin)} min)`);
      return cached.response;
    }
  }

  const json = await rawFetch<T>(endpoint, params);
  if (useCache) {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify(json));
  }
  return json.response;
}

// Tipos mínimos de las respuestas que usa el slice.
export interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string } };
  league: { round: string };
  teams: {
    home: { id: number; name: string; logo: string };
    away: { id: number; name: string; logo: string };
  };
  goals: { home: number | null; away: number | null };
}

export interface ApiStandingGroup {
  league: {
    standings: Array<
      Array<{
        group: string;
        team: { id: number; name: string };
      }>
    >;
  };
}

export function fetchFixtures() {
  // 1 request: todos los partidos del torneo con estado y marcador.
  return apiGet<ApiFixture[]>("/fixtures", { league: LEAGUE, season: SEASON }, 60 * 3);
}

export function fetchStandings() {
  // 1 request: grupos reales del sorteo.
  return apiGet<ApiStandingGroup[]>("/standings", { league: LEAGUE, season: SEASON }, 60 * 12);
}
