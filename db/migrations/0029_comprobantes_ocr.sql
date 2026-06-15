-- Feature: OCR de comprobantes de compra (facturas/tickets/remitos) via IA.
-- pg_trgm para fuzzy match contra el catalogo de insumos; unaccent + lower
-- para normalizar acentos y mayusculas en la comparacion.
create extension if not exists pg_trgm;
create extension if not exists unaccent;

alter table public.compras
  add column comprobante_url text,
  add column comprobante_meta jsonb;

create table public.comprobante_uploads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  proveedor_id uuid references public.proveedores(id) on delete set null,
  storage_path text not null,
  mime_type text,
  status text not null default 'pending'
    check (status in ('pending','parsing','parsed','applied','discarded','error')),
  ai_model text,
  ai_response jsonb,
  parsed_items jsonb,
  compra_id uuid references public.compras(id) on delete set null,
  error_message text,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  parsed_at timestamptz,
  applied_at timestamptz
);

create index idx_comprobante_uploads_tenant on public.comprobante_uploads(tenant_id, created_at desc);
create index idx_comprobante_uploads_proveedor on public.comprobante_uploads(proveedor_id);

alter table public.comprobante_uploads enable row level security;
create policy comprobante_uploads_all on public.comprobante_uploads
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- RPC para fuzzy-match de nombres detectados por la IA contra los insumos del
-- tenant. Devuelve top N con score de similitud de pg_trgm, filtrado por
-- threshold para evitar matches ruidosos.
create or replace function public.match_insumos_by_name(
  p_tenant_id uuid,
  p_query text,
  p_limit int default 3,
  p_threshold real default 0.2
)
returns table (
  insumo_id uuid,
  name text,
  unit text,
  score real
)
language sql
stable
security invoker
as $$
  select
    i.id as insumo_id,
    i.name,
    i.unit::text as unit,
    similarity(lower(unaccent(i.name)), lower(unaccent(p_query))) as score
  from public.insumos i
  where i.tenant_id = p_tenant_id
    and i.active
    and similarity(lower(unaccent(i.name)), lower(unaccent(p_query))) >= p_threshold
  order by score desc
  limit p_limit;
$$;

-- Bucket privado para los archivos de comprobantes y RLS por tenant.
-- El path en Storage debe empezar con el tenant_id (`{tenant_id}/{uuid}-{filename}`)
-- para que las policies funcionen.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprobantes', 'comprobantes', false, 15728640,
  array['image/jpeg','image/png','image/heic','image/heif','application/pdf','image/webp'])
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'comprobantes_read' and tablename = 'objects' and schemaname = 'storage') then
    create policy comprobantes_read on storage.objects for select
      using (
        bucket_id = 'comprobantes'
        and (storage.foldername(name))[1]::uuid in (select public.current_tenant_ids())
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'comprobantes_insert' and tablename = 'objects' and schemaname = 'storage') then
    create policy comprobantes_insert on storage.objects for insert
      with check (
        bucket_id = 'comprobantes'
        and (storage.foldername(name))[1]::uuid in (select public.current_tenant_ids())
      );
  end if;
  if not exists (select 1 from pg_policies where policyname = 'comprobantes_delete' and tablename = 'objects' and schemaname = 'storage') then
    create policy comprobantes_delete on storage.objects for delete
      using (
        bucket_id = 'comprobantes'
        and (storage.foldername(name))[1]::uuid in (select public.current_tenant_ids())
      );
  end if;
end $$;
