-- Agrega proveedor_id al historial de precios y simplifica los triggers.
-- Razón: los precios pueden venir de distintos proveedores (la dueña a veces compra
-- a un proveedor alternativo o cambia el proveedor habitual). El historial necesita
-- saber a quién se le compró en cada cambio. El trigger anterior solo marcaba todo
-- como 'manual'; ahora el logueo de cambios por compra se hace desde la app con
-- el proveedor real de cada compra.

alter table public.insumo_price_history
  add column proveedor_id uuid references public.proveedores(id) on delete set null;

create index idx_price_history_proveedor on public.insumo_price_history(proveedor_id);

-- Backfill: usar el proveedor actual del insumo como mejor estimación para filas existentes
update public.insumo_price_history h
set proveedor_id = i.proveedor_id
from public.insumos i
where h.insumo_id = i.id and h.proveedor_id is null;

-- Trigger INSERT: copiar proveedor_id del insumo
create or replace function public.log_insumo_price_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_price > 0 then
    insert into public.insumo_price_history (insumo_id, tenant_id, price, source, proveedor_id, created_by)
    values (new.id, new.tenant_id, new.current_price, 'manual', new.proveedor_id, auth.uid());
  end if;
  return new;
end;
$$;

-- Drop UPDATE trigger: el logueo de cambios ahora vive en el código de la app
-- (updateInsumo para cambios manuales, updateInsumoPrices para compras).
drop trigger if exists insumo_price_on_update on public.insumos;
drop function if exists public.log_insumo_price_change();
