-- NewsRoller — Permite agregar una Sesión como un contenido más de la Emisión (parrilla/aire).

alter table public.playlist_items drop constraint if exists playlist_items_content_type_check;
alter table public.playlist_items add constraint playlist_items_content_type_check
  check (content_type in ('short', 'placa', 'ad', 'background', 'data', 'template', 'content_item', 'session'));

alter table public.parrilla_draft drop constraint if exists parrilla_draft_content_type_check;
alter table public.parrilla_draft add constraint parrilla_draft_content_type_check
  check (content_type in ('short', 'placa', 'ad', 'background', 'data', 'template', 'content_item', 'session'));
