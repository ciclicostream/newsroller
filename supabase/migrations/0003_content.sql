-- NewsRoller — gestor de contenidos (Sprint 2)
-- Assets binarios (fondos/logos/publicidad) + placas de texto.
-- Escritura vía server (service_role). Lectura pública para el output.

create table if not exists public.assets (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('background', 'logo', 'ad')),
  bucket      text not null,
  path        text not null,
  name        text,
  mime        text,
  size        bigint,
  active      boolean not null default false,
  sort        int not null default 0,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);
create index if not exists assets_kind_idx on public.assets (kind, sort);

comment on table public.assets is 'Fondos, logos y publicidad. El binario vive en Storage; acá va la metadata.';

create table if not exists public.placas (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  accent      text,
  active      boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);
create index if not exists placas_sort_idx on public.placas (sort);

comment on table public.placas is 'Placas de informe (texto). Título + cuerpo + color de acento.';

-- RLS: lectura pública (output con clave anon); escritura sólo server con service_role.
alter table public.assets enable row level security;
alter table public.placas enable row level security;

drop policy if exists "assets lectura pública" on public.assets;
create policy "assets lectura pública" on public.assets for select using (true);

drop policy if exists "placas lectura pública" on public.placas;
create policy "placas lectura pública" on public.placas for select using (true);
