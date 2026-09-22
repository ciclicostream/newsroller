-- NewsRoller — Sesiones: playlists independientes del aire principal, con URL propia (fase 6).

create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,  -- false = detenida (el output muestra la placa fija)
  paused_at   timestamptz,                     -- congela el reloj mientras está detenida (igual que airPausedAt)
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users (id) on delete set null
);

-- Contenidos de cada sesión, mismo esquema que playlist_items/parrilla_draft.
create table if not exists public.session_items (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions (id) on delete cascade,
  content_type  text not null,
  content_id    text,
  template      text,
  duration_sec  int not null default 8,
  enabled       boolean not null default true,
  sort          int not null default 0
);
create index if not exists session_items_session_idx on public.session_items (session_id, sort);

-- Quién (además de Master/Administrador) puede gestionar cada sesión puntual.
create table if not exists public.session_managers (
  session_id  uuid not null references public.sessions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (session_id, user_id)
);

-- Las salidas al aire de una sesión se cuentan aparte de las del aire principal (session_id null = aire principal).
alter table public.airings add column if not exists session_id uuid references public.sessions (id) on delete set null;
create index if not exists airings_session_idx on public.airings (session_id, played_at);

alter table public.sessions enable row level security;
alter table public.session_items enable row level security;
alter table public.session_managers enable row level security;
create policy "sessions lectura pública" on public.sessions for select using (true);
