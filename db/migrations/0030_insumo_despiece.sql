-- Feature: despiece de compra. Permite que un insumo "padre" (ej. cajón de pollo
-- entero) se compre y al guardar la compra se distribuya el stock en N insumos
-- "hijos" (ej. 12 pechugas + 12 pata-muslos) en lugar de acumular stock al padre.
--
-- El padre no lleva stock propio (insumos.track_stock se fuerza a false cuando
-- tiene filas en insumo_despiece). El costo unitario del hijo se calcula como
-- unit_price_padre / sum(qty_por_unidad) — distribución uniforme por unidad
-- generada. Si en el futuro hace falta % configurable por hijo, se agrega
-- como columna sin migrar nada.

alter table public.insumos
  add column if not exists is_despiece_parent boolean not null default false;

create table public.insumo_despiece (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  parent_id       uuid not null references public.insumos(id) on delete cascade,
  hijo_id         uuid not null references public.insumos(id) on delete restrict,
  qty_por_unidad  numeric(10,3) not null check (qty_por_unidad > 0),
  created_at      timestamptz not null default now(),
  unique (parent_id, hijo_id),
  check (parent_id <> hijo_id)
);

create index idx_despiece_parent on public.insumo_despiece(parent_id);
create index idx_despiece_hijo   on public.insumo_despiece(hijo_id);

alter table public.insumo_despiece enable row level security;
create policy insumo_despiece_all on public.insumo_despiece
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));
