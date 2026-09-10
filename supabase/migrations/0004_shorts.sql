-- NewsRoller — shorts de YouTube (Sprint 2)
-- Se sincronizan desde el canal; el título es editable (custom_title) sin tocar YouTube.

create table if not exists public.shorts (
  id            text primary key,               -- id del video de YouTube
  title         text not null,                  -- título original
  custom_title  text,                           -- título editado para el aire
  thumbnail_url text,
  duration_sec  int,
  published_at  timestamptz,
  active        boolean not null default false,
  sort          int not null default 0,
  synced_at     timestamptz not null default now()
);
create index if not exists shorts_sort_idx on public.shorts (sort, published_at desc);

comment on table public.shorts is 'Shorts del canal de Cíclico. custom_title sobrescribe el título al aire.';

alter table public.shorts enable row level security;
drop policy if exists "shorts lectura pública" on public.shorts;
create policy "shorts lectura pública" on public.shorts for select using (true);
