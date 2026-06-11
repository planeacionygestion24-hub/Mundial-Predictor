# DEPLOY.md — De local a producción

Tiempo estimado: 25-35 minutos si ya tienes cuentas. Orden estricto: cada paso verifica el anterior.

## 0. Cuentas necesarias

- api-sports.io (API-Football directo, NO RapidAPI): https://dashboard.api-football.com
- Turso: https://turso.tech (CLI: `curl -sSfL https://get.tur.so/install.sh | bash`)
- GitHub (repo para el cron) y Vercel (UI).

## 1. Data real en local (verifica el modelo antes de tocar producción)

```bash
cp .env.example .env.local      # poner APIFOOTBALL_KEY
pnpm seed                       # ~2 requests: fixtures + standings
pnpm dev
```

Checklist antes de seguir (si algo falla aquí, fallará igual en prod):

- [ ] Home muestra el tablero de campeón y los partidos REALES del 11-12 de junio.
- [ ] `/grupos` muestra los 12 grupos del sorteo real (México en A, etc.), no "demo".
- [ ] `/torneo` muestra la tabla ronda a ronda y los 16 cruces del R32.
- [ ] La consola del seed dijo `[montecarlo] ... simulación guardada`, no "torneo incompleto".

Si dice "torneo incompleto": la API aún no asignó grupos en standings. Verifica con
`APIFOOTBALL_LEAGUE=1 APIFOOTBALL_SEASON=2026`; si el season de la API difiere, es una
env, no código.

## 2. Turso (la DB que lee Vercel y escribe el cron)

```bash
turso auth signup               # o login
turso db create mundial26
turso db show mundial26 --url   # -> TURSO_DATABASE_URL
turso db tokens create mundial26  # -> TURSO_AUTH_TOKEN
```

Poblarla desde tu máquina una vez (mismo seed, apuntando a Turso):

```bash
TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... pnpm seed
```

## 3. GitHub: repo + cron diario

```bash
git init && git add -A && git commit -m "mundial 26 predictor"
gh repo create mundial-predictor --private --source . --push
```

En Settings > Secrets and variables > Actions, agregar los 3 secrets:
`APIFOOTBALL_KEY`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.

Disparar la primera corrida manual: pestaña Actions > recalculo-diario > Run workflow.
Verificar en los logs: `[montecarlo] simulación guardada`. Desde aquí corre solo a las
06:00 Bogotá.

## 4. Vercel: solo la UI

Import del repo en Vercel. Variables de entorno (Production):
`TURSO_DATABASE_URL` y `TURSO_AUTH_TOKEN`. **No** pongas `APIFOOTBALL_KEY` en Vercel:
la UI nunca llama a la API; si la pones y alguien agrega una llamada después, el
límite diario muere en producción.

Deploy. Verificar las tres rutas en el dominio de Vercel.

## 5. Primer clip (hoy)

- Agregar `?capture=1` a cualquier ruta: oculta el header, deja el disclaimer.
- Clip 1: home con el tablero de campeón ("así ve la IA el Mundial").
- Clip 2: `/match/<id-del-inaugural>` con el heatmap de marcador exacto de México.
- Clip 3 (después de la jornada): `/torneo`, columna Campeón, "cómo cambió tras el día 1".
  El histórico ya queda guardado por corrida; ese es el formato que se sostiene 39 días.

## Troubleshooting rápido

- **Quota**: cada respuesta de la API loguea la cuota restante. El cron gasta 2/día;
  si te quedas corto fue desarrollo con `API_CACHE=off`. Pro $19/mes la elimina como tema.
- **El cron de Actions falló**: revisa que los 3 secrets existan; el workflow corre con
  `API_CACHE=off` a propósito (data fresca, sin disco persistente).
- **Vercel muestra data vieja**: las páginas son `force-dynamic`; si ves cache, es el
  navegador, no el server.
- **Fuentes**: cargan por CSS de Google Fonts. Si quieres self-host, migra a `next/font`.
