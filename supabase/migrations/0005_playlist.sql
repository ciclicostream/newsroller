-- NewsRoller — programación (playlist) del autopilot
-- Lista ordenada de bloques que se emiten en loop. Cada bloque: contenido + plantilla + duración.

create table if not exists public.playlist_items (
  id            uuid primary key default gen_random_uuid(),
  content_type  text not null check (content_type in ('short', 'placa', 'ad', 'background', 'data')),
  content_id    text,                 -- id del short/placa/asset o clave de dato (dolar, ipc, ...)
  template      text not null,
  duration_sec  int not null default 8,
  enabled       boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists playlist_sort_idx on public.playlist_items (sort);

comment on table public.playlist_items is 'Guion del autopilot: bloques ordenados (contenido + plantilla + duración).';

alter table public.playlist_items enable row level security;
drop policy if exists "playlist lectura pública" on public.playlist_items;
create policy "playlist lectura pública" on public.playlist_items for select using (true);
