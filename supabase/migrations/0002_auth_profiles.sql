-- NewsRoller — autenticación y roles (Sprint 2)
-- Dos roles: 'admin' (APIs + config avanzada) y 'editor' (gestor de contenidos).

do $$ begin
  create type public.user_role as enum ('admin', 'editor');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  full_name   text,
  role        public.user_role not null default 'editor',
  created_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfil + rol de cada usuario. El rol se gestiona server-side (service_role).';

-- Al crear un usuario en auth.users, se crea su profile (rol editor por defecto).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: cada usuario lee su propio profile. La gestión (listar/crear/cambiar rol) va por el
-- server con service_role (que ignora RLS). Nadie puede auto-ascenderse a admin desde el front.
alter table public.profiles enable row level security;

drop policy if exists "perfil propio: lectura" on public.profiles;
create policy "perfil propio: lectura"
  on public.profiles for select
  using (auth.uid() = id);
