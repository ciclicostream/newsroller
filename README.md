# NewsRoller

Motor de placas en vivo para Cíclico: un **autopilot** que rota e intercala información
(clima, tránsito, dólar, IPC, energía, sismos, incendios, shorts del canal, publicidad...) en
distintos layouts (full pantalla, pantalla al medio, tres cuartos), animada, y se emite en vivo
como **Web Browser Input de vMix**. Se programa la noche anterior y corre solo.

Estado: **backend en construcción** (front pospuesto). Ver plan y bitácora.

## Estructura (monorepo, npm workspaces)

```
packages/shared/  # tipos TS compartidos (contrato de datos)
server/           # Node + Express + Socket.IO — pollers de APIs + realtime + endpoints
supabase/         # migraciones SQL (tablas + buckets)
apps/             # panel/ y output/ (front) — más adelante
```

## Correr el backend

```bash
npm install
cp server/.env.example server/.env   # editable; Supabase es opcional
npm run dev                            # server con watch en http://localhost:4000
```

Sin credenciales de Supabase el server usa un **cache en memoria** y funciona igual.
Al completar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` persiste en la tabla `data_cache`.

### Probar los pollers a mano

```bash
npm run poll -- dolar        # o: datosgob, cammesa   (sin arg = todas)
```

### Endpoints

- `GET /health` — estado del server y tipo de store.
- `GET /api/sources` — estado y última corrida de cada poller.
- `GET /api/data` — todos los payloads cacheados.
- `GET /api/data/:source` — último payload de una fuente (`dolar`, `datosgob`, `cammesa`).

### Realtime (Socket.IO)

Al conectarse, un cliente recibe el snapshot actual (`data:update` por fuente + `sources:status`)
y luego cada actualización de poller en vivo.

## Fuentes de datos actuales (sin API key)

- **dolar** — dolarapi.com (oficial, blue, MEP, CCL, tarjeta, mayorista, cripto).
- **datosgob** — apis.datos.gob.ar: IPC, índice de salarios, ventas de energía eléctrica,
  producción de petróleo (con variación mensual e interanual).
- **cammesa** — demanda eléctrica del SADI en vivo (actual vs previsto vs ayer vs semana anterior, temp).

Las fuentes con key/scraping (clima+SMN, tránsito CABA, YouTube, FIRMS, INPRES, Senado) llegan en
sprints siguientes.
