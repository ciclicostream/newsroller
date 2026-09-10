# Bitácora — NewsRoller

> Leer antes de cada sprint. Actualizar al terminar. Si se omite una tarea del plan, decirlo acá.

Plan completo: `~/.claude/plans/whimsical-noodling-cascade.md`

---

## Sprint 0 + 1 — Andamiaje backend + motor de datos ✅ (2026-09-09)

Hecho:
- Monorepo npm workspaces: `packages/shared`, `server`, `supabase/` (+ `apps/` reservado).
- Repo git propio inicializado (branch `main`), aislado del git del HOME.
- `packages/shared`: contrato de tipos (payloads por fuente, `SourceStatus`, eventos Socket.IO).
- `server`: Express + Socket.IO + TypeScript (corre con `tsx`, sin build).
  - Motor de pollers: interfaz `DataSource`, `Registry` (scheduler + estado + cache + emit).
  - Store intercambiable: memoria (default) / Supabase, sin tocar código.
  - Fuentes verificadas contra la API real: **dolar**, **datosgob**, **cammesa**.
  - Endpoints: `/health`, `/api/sources`, `/api/data`, `/api/data/:source`.
  - Realtime: snapshot al conectar + `data:update`/`sources:status` en cada ciclo.
- Migración `supabase/migrations/0001_init.sql`: tabla `data_cache` (RLS lectura pública) + buckets.
- Verificado: `poll-once` de las 3 fuentes OK, endpoints OK, cliente Socket.IO recibe 3 updates,
  `tsc --noEmit` limpio.

Decisiones / notas:
- **setInterval en vez de node-cron**: el plan mencionaba node-cron, pero los intervalos son en ms
  fijos (60s / 6h), no expresiones cron; setInterval es más simple y sin dependencia extra.
- **IDs de series datos.gob.ar** verificados y vigentes (jul/abr 2026):
  - IPC `148.3_INIVELNAL_DICI_M_26` · salarios `149.1_TL_INDIIOS_OCTU_0_21`
  - energía (ventas EE) `38.3_EE_1994_M_17` · petróleo (YPF) `365.3_PRODUCCION_SA__35`
  - Son override-ables por env `DATOSGOB_SERIES`. "Petróleo" hoy es sólo YPF; se puede cambiar a un
    total país cuando definamos la serie.
- **CAMMESA region 1002 = total SADI** (nacional). Endpoint público sin key.
- Sin Supabase todavía (scaffold local, decidido con el usuario). Falta crear el proyecto y cargar
  `.env` para persistir en `data_cache`.

Pendiente para próximos sprints (del plan, no omitido, sólo diferido):
- Sprint 2: Supabase Auth del panel, Storage (fondos/logos/placas/publicidad), CRUD, modelo
  `onair_state` + `rotation` (autopilot).
- Sprint 3: YouTube Shorts (Data API, título editable).
- Sprint 4: clima+SMN, tránsito CABA, FIRMS, INPRES, Senado + motor de sugerencias.
- Sprint 5: front output + panel (todo parametrizable, incluido lo visual).
- Sprint 6: pulido on-air + deploy para vMix.

Credenciales a conseguir antes de sprints de datos: Supabase, YouTube Data API,
API Transporte BA (client_id/secret), NASA FIRMS MAP_KEY, (opcional) OpenWeather.

---

## Sprint 2 (parcial) — Auth, roles y panel de usuarios ✅ (2026-09-10)

Pedido del usuario: montar en `newsroll.somosciclico.com` + panel de administración de usuarios
con dos roles (**admin**: APIs/config avanzada; **editor/gestor de contenidos**).

Hecho:
- **Migración** `0002_auth_profiles.sql`: enum `user_role`, tabla `profiles` (id→auth.users, role),
  trigger que crea profile al registrarse (rol editor por defecto), RLS (lectura del perfil propio).
- **Backend auth**: middleware `requireAuth` / `requireAdmin` (valida JWT de Supabase + carga rol),
  `ensureAdmins()` que promueve `ADMIN_EMAILS` a admin al arrancar.
  - Endpoints: `GET /api/me`; `GET/POST/PATCH/DELETE /api/users` (sólo admin, vía service_role).
  - Protecciones: no auto-cambiar tu rol, no auto-eliminarte.
- **Front `apps/panel`** (React + Vite + TS, lucide-react, sin emojis): AuthProvider (Supabase),
  login, rutas protegidas por rol, layout con nav filtrada por rol, páginas Panel / Contenido /
  Fuentes-APIs (admin) / **Usuarios** (admin: alta, cambio de rol, baja).
- **Server sirve el panel** buildeado (mismo origen que API + Socket.IO) para un solo subdominio.
- **`docs/DEPLOY.md`**: paso a paso Supabase + Railway + subdominio Hostinger (CNAME) + SSL.

Verificado: `tsc` limpio en server y panel, `vite build` OK, login renderiza en el navegador
(avisa si falta Supabase), server sirve `index.html` en `/` y `/api/me` responde 503 sin Supabase.

Decisiones / notas:
- **Hosting definido con el usuario**: somosciclico está en Hostinger **compartido** → no corre Node
  persistente. Server va a **Railway**; Hostinger sólo aporta DNS (CNAME del subdominio).
- **tsx movido a dependencies** del server (Railway con NODE_ENV=production instalaría sólo deps);
  build del panel requiere `npm install --include=dev` en Railway (documentado).
- Roles en DB: `admin` / `editor`. En UI: "Administrador" / "Gestor de contenidos".
- Primer admin: crear usuario en Supabase y promover con `ADMIN_EMAILS`.

Pendiente inmediato: crear el proyecto Supabase real y hacer el primer deploy (requiere credenciales
del usuario). Sin eso, el login queda deshabilitado (todo lo demás compila y corre).
