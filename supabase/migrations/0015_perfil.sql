-- NewsRoller — Perfil con datos personales (fase 2)
-- Nombre, apellido, teléfono y foto de cada persona + bucket público aparte para las fotos de perfil.
alter table public.profiles add column if not exists first_name text;
alter table public.profiles add column if not exists last_name  text;
alter table public.profiles add column if not exists phone      text;
alter table public.profiles add column if not exists avatar_url text;

-- Las personas que ya tenían "full_name": se reparte en nombre y apellido (el editor lo corrige en Mi perfil).
update public.profiles
   set first_name = split_part(full_name, ' ', 1),
       last_name  = nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), '')
 where full_name is not null and first_name is null;

-- Bucket público APARTE del de las placas (las fotos de perfil no se mezclan con la media de los contenidos).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
