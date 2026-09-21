-- NewsRoller — Roles y sesiones · PASO B (correr después del A)

-- 1) Migrar los roles viejos: admin -> administrador, editor -> programador.
update public.profiles set role = 'administrador' where role = 'admin';
update public.profiles set role = 'programador'   where role = 'editor';

-- 2) Tu cuenta pasa a MASTER (poné acá tu email de ingreso).
update public.profiles set role = 'master' where email = 'paul.caballero@gmail.com';

-- 3) Las cuentas nuevas arrancan con el menor privilegio.
alter table public.profiles alter column role set default 'generador';

-- 4) Desactivar personas (el Administrador no borra: desactiva).
alter table public.profiles add column if not exists active boolean not null default true;

-- 5) Sesiones: entradas/salidas y última actividad (cierre por inactividad y reportes de sesiones por día).
create table if not exists public.user_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  started_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at     timestamptz,
  end_reason   text check (end_reason in ('manual', 'idle', 'replaced'))
);
create index if not exists user_sessions_user_idx on public.user_sessions (user_id, started_at desc);
create index if not exists user_sessions_open_idx on public.user_sessions (user_id) where ended_at is null;

-- Sólo el server (service_role) lee y escribe sesiones.
alter table public.user_sessions enable row level security;
