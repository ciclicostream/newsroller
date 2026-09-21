-- NewsRoller — Banco unificado (fase 4)
-- Índice de TODA la media subida (fotos, videos, logos), con quién la subió, cuándo y cuánto pesa.
-- El binario vive en Storage; esta tabla es el registro. Borrar = mandar a la papelera 30 días.

create table if not exists public.media_files (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null,
  path        text not null,
  name        text,
  mime        text,
  size        bigint,
  kind        text not null default 'image' check (kind in ('image', 'video', 'audio', 'other')),
  source      text not null default 'placa' check (source in ('banco', 'placa', 'importado')),
  asset_id    uuid references public.assets (id) on delete set null,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  deleted_by  uuid references auth.users (id) on delete set null,
  unique (bucket, path)
);
create index if not exists media_files_created_idx on public.media_files (created_at desc);
create index if not exists media_files_deleted_idx on public.media_files (deleted_at) where deleted_at is not null;

-- Sólo el server (service_role) lee y escribe.
alter table public.media_files enable row level security;
