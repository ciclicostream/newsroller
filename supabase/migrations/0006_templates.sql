-- NewsRoller — plantillas propias (editor visual) + foto en placas

create table if not exists public.templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Plantilla',
  background  jsonb not null default '{"type":"color","value":"#ffffff"}',
  elements    jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.templates is 'Plantillas 1920x1080: fondo + elementos posicionados (editor drag & drop).';

alter table public.templates enable row level security;
drop policy if exists "templates lectura pública" on public.templates;
create policy "templates lectura pública" on public.templates for select using (true);

-- Foto opcional en placas (con fondo quitado) + ajuste.
alter table public.placas add column if not exists image_url text;
alter table public.placas add column if not exists image_fit text default 'contain';

-- La playlist ya permite content_type 'template' (el check original no lo incluía): lo ampliamos.
alter table public.playlist_items drop constraint if exists playlist_items_content_type_check;
alter table public.playlist_items add constraint playlist_items_content_type_check
  check (content_type in ('short', 'placa', 'ad', 'background', 'data', 'template'));
