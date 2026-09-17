-- Preferencias del sistema (clave/valor). Las escribe el panel vía server (service_role);
-- las lee el output. Primer uso: velocidad del newsticker del marco (Chrome).
create table if not exists public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

comment on table public.app_settings is 'Preferencias del sistema (key/value). Escribe el server (service_role); lee el output.';

-- RLS: lectura pública (output con clave anon); el server escribe con service_role (ignora RLS).
alter table public.app_settings enable row level security;

drop policy if exists "app_settings lectura pública" on public.app_settings;
create policy "app_settings lectura pública"
  on public.app_settings for select
  using (true);

-- Valor inicial: velocidad del ticker en segundos por vuelta (mayor = más lento).
insert into public.app_settings (key, value)
values ('tickerSpeed', '90'::jsonb)
on conflict (key) do nothing;
