# Deploy — newsroll.somosciclico.com

## Arquitectura

```
  navegador ──> newsroll.somosciclico.com
                    │  (CNAME en Hostinger DNS)
                    ▼
              Railway (Node siempre prendido)
                    │  sirve el panel + /api + Socket.IO
                    ▼
              Supabase (Auth + Postgres + Storage)
```

- **Hostinger** (hosting compartido): sólo aporta el **DNS**. No corre el Node.
- **Railway**: corre el server Node (pollers + Socket.IO + API) y **sirve el panel** en el mismo origen.
- **Supabase**: login, usuarios/roles y datos.

---

## Paso 1 — Supabase (Auth + base)

1. Entrar a https://supabase.com → **New project**. Nombre `newsroller`, elegí región cercana
   (South America / São Paulo) y guardá la **Database password**.
2. Cuando termine de crear, ir a **Project Settings → API** y copiar:
   - `Project URL` → será `SUPABASE_URL`.
   - `anon public` key → será `VITE_SUPABASE_ANON_KEY` (front).
   - `service_role` key → será `SUPABASE_SERVICE_ROLE_KEY` (server; **secreta**, nunca en el front).
3. Correr las migraciones: **SQL Editor → New query**, pegar y ejecutar en orden el contenido de:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_auth_profiles.sql`
4. Configurar Auth: **Authentication → Providers → Email** activado. Para el arranque conviene
   **desactivar "Confirm email"** (Authentication → Sign In / Providers) así los usuarios que creás
   desde el panel entran directo.
5. Crear el **primer administrador**:
   - **Authentication → Users → Add user** → email + password (marcá "Auto confirm").
   - Ese usuario queda como `editor` por defecto. Para hacerlo admin, en Railway (Paso 2) poné
     `ADMIN_EMAILS=tu-email@somosciclico.com` y al reiniciar se promueve solo.
   - (Alternativa por SQL: `update public.profiles set role='admin' where email='tu-email';`)

---

## Paso 2 — Railway (server)

1. Subir el repo a GitHub (ver `git` abajo).
2. https://railway.app → **New Project → Deploy from GitHub repo** → elegir `NewsRoller`.
3. En el servicio, **Settings**:
   - **Build Command**: `npm install --include=dev && npm run build`
     (el `--include=dev` es necesario para que Vite compile el panel).
   - **Start Command**: `npm start`
4. **Variables** (Settings → Variables) — ver tabla al final. Mínimo:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAILS`, `CORS_ORIGIN=https://newsroll.somosciclico.com`.
   > El panel se sirve desde el mismo Railway, así que `VITE_*` se toman en build: agregarlas también
   > como variables (Railway las expone al build). `VITE_API_URL` dejarla **vacía** (mismo origen).
5. Deploy. Cuando termine, Railway da una URL tipo `newsroller-production.up.railway.app`.
   Probala: debería abrir el login del panel.

---

## Paso 3 — Subdominio en Hostinger (DNS)

> En hosting compartido NO uses "Crear subdominio" (eso crea una carpeta en el server de Hostinger).
> Usá el **editor de zona DNS** para apuntar el subdominio a Railway con un CNAME.

1. hPanel → **Dominios → somosciclico.com → DNS / Nameservers → Zona DNS** (DNS Zone Editor).
2. **Agregar registro**:
   - Tipo: `CNAME`
   - Nombre / Host: `newsroll`
   - Apunta a / Valor: el dominio que te dé Railway en el Paso 4 (ej: `xxxx.up.railway.app`)
   - TTL: por defecto.
3. Guardar. Si hubiera un registro `A` previo para `newsroll`, borralo (no puede coexistir con el CNAME).

---

## Paso 4 — Dominio propio en Railway + SSL

1. En Railway → servicio → **Settings → Networking → Custom Domain** → escribir
   `newsroll.somosciclico.com`.
2. Railway muestra el **valor de CNAME** exacto a usar → copialo al registro del Paso 3
   (si ya lo pusiste, ajustá el valor al que indique Railway).
3. Esperar propagación (minutos a un par de horas). Railway emite el **certificado SSL** solo.
4. Listo: `https://newsroll.somosciclico.com` sirve el panel; login con el admin del Paso 1.

---

## Variables de entorno

| Variable | Dónde | Valor |
|---|---|---|
| `SUPABASE_URL` | Railway | Project URL de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway (secreta) | service_role key |
| `ADMIN_EMAILS` | Railway | emails admin separados por coma |
| `CORS_ORIGIN` | Railway | `https://newsroll.somosciclico.com` |
| `VITE_SUPABASE_URL` | Railway (build) | igual a `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Railway (build) | anon key |
| `VITE_API_URL` | Railway (build) | vacío (mismo origen) |
| `PORT` | Railway | lo setea Railway solo; no hace falta |
| `CAMMESA_REGION` | Railway (opcional) | `1002` (default) |

---

## Verificación

- `https://newsroll.somosciclico.com/health` → `{ "ok": true, "store": "supabase" }`.
- Login con el admin → ver la sección **Usuarios** en el menú (sólo aparece a admins).
- Crear un usuario `editor` → confirmar que al entrar **no** ve Usuarios ni Fuentes/APIs.

---

## Git (primera vez)

```bash
cd "~/Laburos/Cíclico/NewsRoller"
git add -A
git commit -m "NewsRoller: backend datos + auth/roles + panel de usuarios"
gh repo create ciclicostream/newsroller --private --source=. --push
```

(o crear el repo a mano en GitHub y `git remote add origin ... && git push -u origin main`)
