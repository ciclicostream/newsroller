-- NewsRoller — Estilos (colecciones de templates) y links de salida con nombre.

-- 1) Fecha de edición de cada contenido. La usan las templates que muestran "cuándo se escribió o editó"
--    (hora de Última Hora, fecha de Placas). Se actualiza sola cuando cambian los datos del contenido.
alter table public.content_items add column if not exists updated_at timestamptz;
update public.content_items set updated_at = created_at where updated_at is null;
alter table public.content_items alter column updated_at set default now();

create or replace function public.content_items_touch() returns trigger
language plpgsql as $$
begin
  if new.data is distinct from old.data then
    new.updated_at = now();
  end if;
  return new;
end $$;

drop trigger if exists content_items_touch on public.content_items;
create trigger content_items_touch before update on public.content_items
  for each row execute function public.content_items_touch();

-- 2) Links de salida con nombre: /output/<slug>. La configuración vive acá y sólo se cambia desde el panel.
create table if not exists public.output_links (
  slug        text primary key check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  label       text,
  target      text not null default 'emision' check (target in ('emision', 'sesion', 'stream')),
  session_id  uuid references public.sessions (id) on delete cascade,
  orientation text not null default 'horizontal' check (orientation in ('horizontal', 'vertical')),
  audio       boolean not null default false,
  style       text,                                  -- null = sigue Ajustes → Estilos
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint output_links_session_chk check (target <> 'sesion' or session_id is not null)
);

comment on table public.output_links is 'Links de salida con nombre (/output/<slug>). Los lee el output vía server; se editan desde el panel.';

-- Sin políticas: sólo el server (service_role) lee y escribe.
alter table public.output_links enable row level security;

-- 3) Preferencias nuevas: colección activa y links viejos con variables (se apagan al pasar a links con nombre).
insert into public.app_settings (key, value) values ('style', '"clasica"'::jsonb) on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('legacyLinks', 'true'::jsonb) on conflict (key) do nothing;
