-- NewsRoller — Output vertical: cada salida al aire guarda en qué orientación se emitió
-- (horizontal = la de siempre, vertical = 1080x1920). Los reportes las muestran por separado.
alter table public.airings add column if not exists orientation text not null default 'horizontal'
  check (orientation in ('horizontal', 'vertical'));
create index if not exists airings_orientation_idx on public.airings (orientation, played_at);
