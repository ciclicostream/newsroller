-- Bucket público para la media embebida en plantillas/placas/última hora.
-- Se separa del bucket "ads" a propósito: la ruta /ads/ la bloquean los adblockers
-- (uBlock/AdBlock) y las imágenes no cargaban en Chrome. "media" es un nombre neutro.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
