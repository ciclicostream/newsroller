-- NewsRoller — Disponibilidad de una Sesión como contenido de Emisión, separada de si está en vivo.
-- "active" = está transmitiendo en su propio link (corte de emergencia). "in_parrilla" = aparece o no
-- en "Contenidos disponibles" de Emisión para agregarla como bloque (igual que cualquier otro contenido).

alter table public.sessions add column if not exists in_parrilla boolean not null default true;
