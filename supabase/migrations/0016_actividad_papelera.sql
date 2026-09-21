-- NewsRoller — Registro de actividad y papelera de 30 días (fase 3)

-- 1) Papelera: los contenidos borrados no se eliminan; quedan marcados 30 días (después se purgan solos).
alter table public.content_items add column if not exists deleted_at timestamptz;
alter table public.content_items add column if not exists deleted_by uuid references auth.users (id) on delete set null;
create index if not exists content_items_deleted_idx on public.content_items (deleted_at) where deleted_at is not null;

-- 2) Registro de actividad: quién hizo qué y cuándo (base de los reportes).
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  at          timestamptz not null default now(),
  actor_id    uuid references auth.users (id) on delete set null,
  actor_name  text,
  actor_role  text,
  action      text not null,
  entity      text,
  entity_id   text,
  summary     text,
  meta        jsonb not null default '{}'
);
create index if not exists activity_log_at_idx     on public.activity_log (at desc);
create index if not exists activity_log_actor_idx  on public.activity_log (actor_id, at desc);
create index if not exists activity_log_action_idx on public.activity_log (action, at desc);

-- Sólo el server (service_role) lee y escribe el registro.
alter table public.activity_log enable row level security;
