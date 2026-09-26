-- NewsRoller — Suites: cada link con nombre lleva su propia colección de templates.
-- Ya no hay un estilo global: el Master habilita qué colecciones se pueden usar y cada suite (link) elige una.

update public.output_links set style = 'clasica' where style is null;
alter table public.output_links alter column style set default 'clasica';
alter table public.output_links alter column style set not null;

comment on column public.output_links.style is 'Colección de templates de la suite (link). Se cambia sin tocar la URL; entra en el próximo contenido.';

-- Colecciones habilitadas por el Master (las demás no se pueden elegir para una suite).
insert into public.app_settings (key, value) values ('collections', '["clasica"]'::jsonb) on conflict (key) do nothing;
-- El estilo global de la versión anterior ya no se usa.
delete from public.app_settings where key = 'style';
