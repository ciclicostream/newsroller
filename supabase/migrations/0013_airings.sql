-- Registro de salidas al aire de contenidos de Publicidad (para el reporte).
create table if not exists airings (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references content_items(id) on delete cascade,
  played_at timestamptz not null default now()
);
create index if not exists airings_content_item_id_idx on airings(content_item_id);
create index if not exists airings_played_at_idx on airings(played_at);

alter table airings enable row level security;
create policy "airings select" on airings for select using (true);
