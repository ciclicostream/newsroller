-- Placa Dólar (2026): historial diario de cotizaciones para calcular la variación
-- ▲/▼ contra el día anterior. El poller (server, service_role) escribe/lee esta
-- tabla en cada fetch; el output NUNCA la consulta directo (usa el payload cacheado).
create table if not exists public.dolar_history (
  casa        text not null,
  day         date not null,
  compra      numeric,
  venta       numeric,
  updated_at  timestamptz not null default now(),
  primary key (casa, day)
);

comment on table public.dolar_history is 'Snapshot diario por casa de cambio (dolarapi.com). Escribe el server; sirve para la variación vs día anterior en la placa Dólar.';

alter table public.dolar_history enable row level security;

drop policy if exists "dolar_history lectura pública" on public.dolar_history;
create policy "dolar_history lectura pública"
  on public.dolar_history for select
  using (true);
