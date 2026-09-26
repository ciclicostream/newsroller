-- NewsRoller — Salida única del canal y suites.
-- La salida del canal es UNA señal (Copiloto; cuando el Host abre Stream, pasa a Stream) con dos links fijos:
-- uno horizontal y uno vertical. Los links no llevan colección: usan la suite activa (ajustes suites/activeSuite).
-- Los links creados antes (por sesión, por Stream o con colección propia) se reemplazan por los dos del canal.

delete from public.output_links;

insert into public.output_links (slug, target, orientation, audio, style)
values ('ciclico', 'emision', 'horizontal', true, 'clasica'),
       ('ciclico-vertical', 'emision', 'vertical', true, 'clasica')
on conflict (slug) do nothing;

-- Uno por orientación.
create unique index if not exists output_links_orientation_uq on public.output_links (orientation);

comment on table public.output_links is 'Links de la salida del canal (/output/<slug>): uno horizontal y uno vertical. Usan la suite activa.';

-- Suites: la de arranque usa las templates Clásicas.
insert into public.app_settings (key, value) values ('suites', '[{"id":"clasica","name":"clasica","style":"clasica"}]'::jsonb) on conflict (key) do nothing;
insert into public.app_settings (key, value) values ('activeSuite', '"clasica"'::jsonb) on conflict (key) do nothing;
