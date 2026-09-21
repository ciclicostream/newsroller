-- NewsRoller — Reportes semanales/mensuales (fase 5)

-- 1) Salidas al aire de TODOS los tipos (antes sólo Publicidad).
alter table public.airings add column if not exists content_type text;
alter table public.airings add column if not exists duration_sec int;
create index if not exists airings_content_type_idx on public.airings (content_type, played_at);

-- 2) Incidentes automáticos: caídas de fuentes de datos, cámaras sin señal, fotos/videos rotos.
create table if not exists public.incidents (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('fuente', 'camara', 'media')),
  key          text not null,               -- id de la fuente / cámara, o URL de la media
  label        text,
  detail       text,
  item_id      uuid,                        -- contenido al aire cuando se detectó (media rota)
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at     timestamptz,                 -- null = sigue abierto (o cerrado por falta de nuevos avisos)
  count        int not null default 1       -- cuántas veces se vio el problema
);
create index if not exists incidents_started_idx on public.incidents (started_at desc);
create index if not exists incidents_open_idx on public.incidents (kind, key) where ended_at is null;
alter table public.incidents enable row level security;

-- 3) Intentos de ingreso fallidos (los avisa el panel de ingreso).
create table if not exists public.login_attempts (
  id    uuid primary key default gen_random_uuid(),
  at    timestamptz not null default now(),
  email text,
  ip    text,
  ok    boolean not null default false
);
create index if not exists login_attempts_at_idx on public.login_attempts (at desc);
alter table public.login_attempts enable row level security;
