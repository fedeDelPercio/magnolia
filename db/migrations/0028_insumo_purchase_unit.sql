-- Presentacion de compra opcional por insumo. Cuando estan seteados, el insumo
-- "se compra como cajon/maple/bolsa" pero el stock y las recetas siguen
-- midiendose en su unidad base (`unit`). Las conversiones se hacen en el
-- cliente al armar la compra: el factor representa "cuantas unidades base
-- trae 1 unidad de compra" (ej: 1 cajon = 10 kg => factor=10).
alter table public.insumos
  add column purchase_unit_label text,
  add column purchase_unit_factor numeric;

alter table public.insumos
  add constraint insumos_purchase_unit_consistency
  check (
    (purchase_unit_label is null and purchase_unit_factor is null)
    or (purchase_unit_label is not null and purchase_unit_factor is not null and purchase_unit_factor > 0)
  );
