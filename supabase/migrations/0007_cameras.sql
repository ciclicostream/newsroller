-- NewsRoller — cámaras en vivo (YouTube / HLS / imagen que refresca / iframe)

create table if not exists public.cameras (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  city        text,
  type        text not null check (type in ('youtube', 'hls', 'image', 'iframe')),
  url         text not null unique,   -- youtube: videoId · hls: m3u8 · image: url jpg · iframe: embed url
  active      boolean not null default false,
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);

comment on table public.cameras is 'Cámaras en vivo. url según type (videoId de YouTube, m3u8, imagen, o embed).';

alter table public.cameras enable row level security;
drop policy if exists "cameras lectura pública" on public.cameras;
create policy "cameras lectura pública" on public.cameras for select using (true);

-- Cámaras iniciales (las que pasó el usuario).
insert into public.cameras (name, city, type, url, active, sort) values
  ('9 de Julio',              'CABA',              'youtube', 'NfsyRx50gAI', true,  0),
  ('CABA - Varias',           'CABA',              'youtube', 'Au3zbPZTSXk', false, 1),
  ('Cerro Castor',            'Tierra del Fuego',  'youtube', 'O_JAplYN4AA', false, 2),
  ('Puente General Belgrano', 'Corrientes/Chaco',  'youtube', 'ejCNMfJga2o', false, 3),
  ('Las Grutas',              'Río Negro',         'youtube', 'hNWOyxBBCJs', false, 4)
on conflict (url) do nothing;
