-- NewsRoller — Banco de contenidos 2026 (rediseño): contenidos tipados.
-- Cada fila = un contenido de un TIPO (ultima_hora, dolar, cifras, ...) con sus datos en `data` (jsonb).
-- El layout/animación lo define el tipo en el output. La parrilla (playlist_items) referencia estos ítems.

create table if not exists public.content_items (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,                 -- 'ultima_hora', 'dolar', 'cifras', ...
  data          jsonb not null default '{}',   -- campos propios del tipo
  duration_sec  int not null default 8,        -- duración por bloque (editable)
  active        boolean not null default true, -- disponible en el banco
  sort          int not null default 0,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null
);
create index if not exists content_items_type_idx on public.content_items (type, sort);

comment on table public.content_items is 'Banco de contenidos tipados 2026 (ultima_hora, etc.). data jsonb con los campos del tipo.';

alter table public.content_items enable row level security;
drop policy if exists "content_items lectura pública" on public.content_items;
create policy "content_items lectura pública" on public.content_items for select using (true);

-- La parrilla ahora también acepta 'content_item' (referencia content_items.id en content_id).
alter table public.playlist_items drop constraint if exists playlist_items_content_type_check;
alter table public.playlist_items add constraint playlist_items_content_type_check
  check (content_type in ('short', 'placa', 'ad', 'background', 'data', 'template', 'content_item'));
