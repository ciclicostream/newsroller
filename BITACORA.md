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

---

## Deploy productivo ✅ (2026-09-10)

- Repo pusheado a `git@github.com:ciclicostream/newsroller.git` (SSH ok como ciclicostream).
- Supabase real creado; migraciones 0001+0002 corridas; primer admin vía `ADMIN_EMAILS`.
- Server desplegado en **Railway** (build `npm install --include=dev && npm run build`, start `npm start`,
  PORT=8080). Sirve el panel + API + Socket.IO. `store: supabase` confirmado.
- Fix aplicado: normalizar SUPABASE_URL/VITE_SUPABASE_URL (quitar barra final). El bug real que
  frenaba los pollers era una **URL de Supabase mal cargada** en Railway ("Invalid path" de Kong);
  se corrigió el valor de la variable y los 3 pollers pasaron a ok.
- Subdominio **newsroll.somosciclico.com**: CNAME + TXT (generado por Railway) en zona DNS de
  Hostinger → Railway; SSL Let's Encrypt emitido. Login verificado desde el subdominio por el usuario.
- Trampa resuelta en el camino: un comando quedó en "Pre-deploy Command" de Railway y colgaba el
  deploy → debe quedar vacío.

Próximo: Sprint de contenido (gestor: fondos/logos/placas/publicidad/shorts) + rotación autopilot,
que alimenta el output para vMix.

---

## Sprint 2 (cont.) — Gestor de contenidos ✅ código (2026-09-10)

- **Migración `0003_content.sql`**: tablas `assets` (background/logo/ad → Storage) y `placas` (texto).
  RLS lectura pública (output), escritura sólo server. **Falta correrla en Supabase.**
- **Backend `routes/content.ts`** (requireAuth, admin+editor):
  - Subida directa a Storage con **URL firmada** (`/content/uploads/sign` → el binario NO pasa por el
    server) + registro de metadata (`/content/assets`). CRUD de assets y de placas.
- **Front**: `lib/content.ts` (uploadAsset con `uploadToSignedUrl`) + página **Contenido** con pestañas
  Fondos / Logos / Publicidad / Placas (subida múltiple, activar/inactivar, eliminar; placas con
  título/cuerpo/color de acento).
- Verificado: `tsc` + `vite build` OK. Falta probar en vivo (requiere migración 0003 + deploy).

Pendiente: correr `0003` en Supabase; luego probar subir un fondo/logo desde el panel en producción.
Después: rotación/autopilot (consume assets+placas activos) y output para vMix.

---

## Sprint 2 (cont.) — Fix editor + Shorts de YouTube ✅ código (2026-09-10)

Bug corregido (reportado por el usuario): el `requireAdmin` de `usersRouter` estaba montado en `/api`
y se filtraba a `/api/content/*` (router-level `use` corre para todo lo que entra al mount). El editor
recibía 403 "requiere rol administrador" en contenido. Fix: montar `usersRouter` en `/api/users` y
`contentRouter` en `/api/content` (rutas internas sin el prefijo). Toggle "Al aire" pasó a botón-pill visible.

Shorts de YouTube:
- Migración `0004_shorts.sql`: tabla `shorts` (id de YouTube, title, **custom_title** editable,
  thumbnail, duration_sec, active, sort). RLS lectura pública. **Falta correrla en Supabase.**
- `server/src/content/youtube.ts`: resuelve canal por handle (`forHandle`), trae uploads, filtra
  shorts (duración ≤ 180s), upsert preservando custom_title/active/sort. Env: `YOUTUBE_API_KEY`,
  `YOUTUBE_CHANNEL_HANDLE` (default `somosciclico`), `YOUTUBE_SYNC_MS` (30 min).
- Endpoints en content router: `POST /shorts/sync`, `GET/PATCH/DELETE /shorts`. Auto-sync al arrancar.
- Panel: pestaña **Shorts** (sincronizar, editar título inline, activar, quitar).

Pendiente en Supabase: correr `0003` y `0004`. En Railway: confirmar `YOUTUBE_API_KEY` cargada.
Handle del canal corregido a `@esciclico` (default en código).

---

## Sprint 2 (cont.) — Programación (playlist) + plantillas ✅ código (2026-09-10)

- **Plantillas**: catálogo fijo en `shared` (`TEMPLATES`): full-media, short-916, placa-full,
  placa-medio, data-full, data-medio, tres-cuartos. Cada una con `appliesTo` (tipos de contenido).
  `DATA_BLOCKS` define qué datos se pueden poner como bloque (dolar, cammesa, ipc, salarios, energía, petróleo).
- **Migración `0005_playlist.sql`**: tabla `playlist_items` (content_type, content_id, template,
  duration_sec, enabled, sort). RLS lectura pública. **Falta correrla en Supabase.**
- **Backend** `routes/playlist.ts` (requireAuth, `/api/playlist`): GET, POST (add), PATCH, DELETE,
  POST /reorder. Valida content_type y template contra el catálogo.
- **Front** página **Programación**: agregar bloque (tipo → elemento → plantilla → duración),
  lista ordenada con subir/bajar, cambio de plantilla y duración inline, activar/pausar, quitar.
  Muestra total de segundos por vuelta. Nuevo ítem de menú (visible a admin y editor).

El modelo de emisión es **playlist explícita** (el usuario elige qué y en qué orden), no auto por
"active". Los toggles "Al aire" de Contenido quedan como marca de disponibilidad; la playlist manda.

Pendiente Supabase: correr `0005` (y las previas 0003/0004 si faltan).
Próximo: **output para vMix** que reproduce la playlist con las plantillas + data en vivo.

---

## Sprint 5 (adelantado) — Output para vMix ✅ código (2026-09-10)

- **Endpoint público** `GET /api/output/scene` (sin auth): arma la escena = fondo activo + logos
  activos + playlist habilitada (cada bloque resuelto a algo auto-contenido) + data cacheada.
- **Server** sirve dos front: panel en `/`, **output en `/output`** (app propia, base `/output/`).
  Root build script ahora compila panel + output. Railway: mismo build command sirve.
- **App `apps/output`** (React + Vite + framer-motion + socket.io-client):
  - Lienzo fijo 1920×1080 escalado al viewport (ideal para Web Browser Input de vMix).
  - Fondo (video/imagen) + chrome fijo (logo, reloj, ticker con data en vivo).
  - Reproductor en loop de la playlist; cada bloque con su plantilla animada (framer-motion),
    dura sus segundos y avanza; al dar la vuelta recarga la escena. Data en vivo por Socket.IO.
  - Plantillas implementadas: short-916 (iframe YouTube 9:16 + título palabra x palabra),
    full-media, placa-full, placa-medio, data-full, data-medio, tres-cuartos. Standby si vacía.
- Verificado local: `/output/` sirve la app, ticker con data real (dólar), reloj, standby. Falta
  probar con playlist real en producción (requiere migración 0005 + bloques cargados).

Para vMix: agregar `https://newsroll.somosciclico.com/output` como Web Browser Input 1920×1080.
Pendiente producción: correr migraciones 0003/0004/0005 en Supabase y armar una playlist.
