# Mundial 26 · Modelo IA (slice 1)

Proyección estadística de mercados por partido del Mundial 2026. Modelo Poisson propio, recalculado a diario. Análisis de entretenimiento; no recibe ni procesa apuestas.

## Qué incluye este slice

- Ingesta desde API-Football (directo a api-sports.io) con cache a disco obligatorio.
- Modelo Poisson en `lib/model/` (puro, sin red, con tests): 1X2, doble oportunidad, over/under 1.5/2.5/3.5, BTTS, marcador exacto (heatmap + top 5), portería en cero, gana a cero.
- Lambdas: prior por ranking FIFA mezclado con forma observada en DB. Bonus de anfitrión para MEX/USA/CAN.
- DB: SQLite local (`file:local.db`) en desarrollo, Turso en producción. Mismo schema, cambia una URL.
- Cron diario por GitHub Actions; las predicciones se guardan con timestamp (histórico).
- UI broadcast: home con ticker de partidos y vista de partido con todos los mercados.

Fuera del slice (siguiente fase): tarjetas, corners, goleadores, Monte Carlo de campeón y tabla por grupo.

## Correr en local

```bash
pnpm install
cp .env.example .env.local        # poner APIFOOTBALL_KEY (api-sports.io, no RapidAPI)
pnpm seed                         # fixture real: ~2 requests de API
pnpm dev                          # localhost:3000
```

Sin API key, para ver la interfaz con datos de ejemplo:

```bash
pnpm seed:demo
pnpm dev
```

Otros comandos: `pnpm cron:run` (recalculo manual), `pnpm test` (tests del modelo), `pnpm typecheck`.

## Presupuesto de requests (plan free: 100/día)

El cron consume 2 requests por corrida en este slice (fixtures + standings; un request de fixtures trae los 104 partidos). El cache a disco (`.cache/api`) hace que tus corridas de desarrollo no gasten cuota: `API_CACHE=off` solo cuando necesites data fresca de verdad. Cuando se agreguen stats por partido (tarjetas, corners), el día pico sube a ~30 requests; sigue cabiendo.

## Producción

Runbook completo paso a paso en **DEPLOY.md** (Turso, GitHub Actions, Vercel, primer clip). Resumen:

1. **Turso**: `turso db create mundial26`, copiar URL y token a `TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`.
2. **GitHub Actions**: agregar los tres secrets (`APIFOOTBALL_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`). El workflow `.github/workflows/cron.yml` corre a las 06:00 Bogotá y se puede disparar manual desde la pestaña Actions.
3. **Vercel**: deploy normal del Next con las dos env de Turso. Vercel solo sirve la UI; nunca llama a API-Football.

Primera corrida en producción: dispara el workflow manual (workflow_dispatch) para poblar Turso antes del primer deploy.

## Decisiones que conviene conocer

- `better-sqlite3` se reemplazó por `@libsql/client` (API async) para que el mismo código funcione contra archivo local y contra Turso.
- El ranking FIFA vive en `lib/model/ranks.ts` como constante editable del modelo (API-Football no lo expone). Equipos no listados usan ranking 40.
- Las fuentes se cargan por CSS de Google Fonts; si prefieres self-host, migra a `next/font` en `app/layout.tsx`.
- Constantes del modelo (MU, ALPHA, PRIOR_WEIGHT, HOST_BONUS) documentadas en `lib/model/lambda.ts`.
- Modo captura para clips: `?capture=1` en cualquier ruta oculta el header y deja el disclaimer.
