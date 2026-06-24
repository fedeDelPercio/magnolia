-- Memoria de matches manuales de comprobantes: cuando el user aprueba el match
-- entre un texto de factura (ej "BONDIOLA DE CERDO X KG") y un insumo del
-- catalogo ("Bondiola"), guardamos un alias por (tenant, proveedor, texto
-- normalizado). En el siguiente comprobante del mismo proveedor con el mismo
-- texto, el sistema auto-matchea sin intervencion.
--
-- La normalizacion (lower + unaccent + collapse whitespace) la hace la app
-- antes de insertar/buscar, porque unaccent() no es IMMUTABLE en Postgres y
-- no se puede usar en columnas generadas ni unique indexes.

create table public.insumo_aliases (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  insumo_id uuid not null references public.insumos(id) on delete cascade,
  raw_text text not null,
  raw_text_normalized text not null,
  hit_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, proveedor_id, raw_text_normalized)
);

create index idx_insumo_aliases_lookup
  on public.insumo_aliases(tenant_id, proveedor_id, raw_text_normalized);
create index idx_insumo_aliases_insumo on public.insumo_aliases(insumo_id);

alter table public.insumo_aliases enable row level security;

create policy insumo_aliases_all on public.insumo_aliases
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));
