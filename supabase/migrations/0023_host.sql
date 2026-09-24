-- NewsRoller — Rol Host (opera Stream, la radio manual). Correr solo, en una consulta aparte:
-- Postgres no deja usar un valor nuevo del enum en la misma transacción en que se lo agrega.
alter type public.user_role add value if not exists 'host';
