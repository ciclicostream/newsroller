-- NewsRoller — Roles y sesiones · PASO A (correr primero, solo)
-- Agrega los 4 roles nuevos al tipo user_role. Postgres no deja USAR un valor nuevo en la misma
-- transacción en que se lo agrega, por eso esto va aparte del paso B.
alter type public.user_role add value if not exists 'master';
alter type public.user_role add value if not exists 'administrador';
alter type public.user_role add value if not exists 'programador';
alter type public.user_role add value if not exists 'generador';
