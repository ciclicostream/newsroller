-- NewsRoller — Parrilla borrador (playout preview/program).
-- El editor arma el orden en BORRADOR (parrilla_draft) y al "Enviar al aire" se copia a
-- playlist_items (lo que rota el output). Así editar la parrilla NO sale al instante.

create table if not exists public.parrilla_draft (
  id            uuid primary key default gen_random_uuid(),
  content_type  text not null check (content_type in ('short', 'placa', 'ad', 'background', 'data', 'template', 'content_item')),
  content_id    text,
  template      text not null default 'custom',
  duration_sec  int not null default 8,
  enabled       boolean not null default true,
  sort          int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists parrilla_draft_sort_idx on public.parrilla_draft (sort);

comment on table public.parrilla_draft is 'Borrador de la parrilla. Se publica a playlist_items con "Enviar al aire".';

alter table public.parrilla_draft enable row level security;
-- Sin policy pública: sólo el server (service_role) lo lee/escribe. El output NO lo usa.

-- Marca de disponibilidad en el banco (mostrar/ocultar en la lista de disponibles de la parrilla).
alter table public.content_items add column if not exists in_parrilla boolean not null default true;
