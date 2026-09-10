-- NewsRoller — migración inicial (Sprint 0/1)
-- Sólo lo que usa el motor de datos por ahora. Assets/placas/rotación llegan en Sprint 2.

-- Cache de payloads de las fuentes de datos (dólar, datos.gob.ar, CAMMESA, ...).
create table if not exists public.data_cache (
  source      text primary key,
  payload     jsonb not null,
  fetched_at  timestamptz not null default now()
);

comment on table public.data_cache is 'Último payload normalizado por fuente. Lo escribe el server (service_role); lo lee el output.';

-- RLS: el output (clave anon) sólo lee; el server escribe con service_role (que ignora RLS).
alter table public.data_cache enable row level security;

drop policy if exists "data_cache lectura pública" on public.data_cache;
create policy "data_cache lectura pública"
  on public.data_cache for select
  using (true);

-- Buckets de Storage para los assets (se usan a partir del Sprint 2).
insert into storage.buckets (id, name, public)
values
  ('backgrounds', 'backgrounds', true),
  ('logos', 'logos', true),
  ('ads', 'ads', true),
  ('placas', 'placas', true)
on conflict (id) do nothing;
