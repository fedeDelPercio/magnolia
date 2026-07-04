-- La vista insumo_stock solo descontaba INGREDIENTES (via receta) por produccion.
-- Los descartables (bolsa, bandeja, envases, cubiertos) nunca se descontaban
-- del stock — solo se usaban para calcular costo. Eso dejaba dos problemas:
--
-- 1. Un producto con descartables (ej. cafe con vaso) nunca reducia el stock
--    del vaso aunque tuvieramos track_stock activo en el vaso.
-- 2. En el modelo de variantes: la variante "Empanada Delivery" tiene bolsa +
--    bandeja que la "Empanada" base no tiene. Ninguna de esas se descontaba,
--    y no habia forma de contabilizar el consumo real de packaging delivery.
--
-- Fix: agregar un CTE consumido_descartables que descuenta por VENTA (no por
-- produccion), porque el envase se usa recien cuando se sirve/despacha. Idem
-- para el filtro de baseline por ultimo ajuste (mismo criterio que ingredientes).
--
-- Modelo mental:
--   ingrediente = se usa cuando cocinas   -> descuento por produccion
--   descartable = se usa cuando servis    -> descuento por venta

create or replace view public.insumo_stock
with (security_invoker = true)
as
with last_ajuste as (
  select distinct on (insumo_id)
    insumo_id, stock_real as baseline, created_at as since
  from insumo_stock_ajustes
  order by insumo_id, created_at desc
),
comprado as (
  select ci.insumo_id,
    sum(normalize_qty(ci.qty, ci.unit::text, i1.unit::text)) as qty
  from compra_items ci
  join insumos i1 on i1.id = ci.insumo_id
  left join last_ajuste la on la.insumo_id = ci.insumo_id
  where la.since is null or ci.created_at > la.since
  group by ci.insumo_id
),
consumido_ingredientes as (
  -- Ingredientes de receta consumidos por produccion. Sin cambios respecto
  -- a la version anterior de la vista.
  select ri.insumo_id,
    sum((md.produccion / nullif(r.yield_qty, 0::numeric))
      * normalize_qty(ri.qty, ri.unit::text, i1.unit::text)) as qty
  from movimientos_diarios md
  join productos p on p.id = md.producto_id
  join recetas r on r.id = p.receta_id
  join receta_ingredientes ri on ri.receta_id = r.id and ri.kind = 'insumo'::ingrediente_kind
  join insumos i1 on i1.id = ri.insumo_id
  join dias_operativos d on d.id = md.dia_id
  left join last_ajuste la on la.insumo_id = ri.insumo_id
  where md.produccion > 0::numeric
    and (la.since is null or d.fecha >= la.since::date)
  group by ri.insumo_id
),
consumido_descartables as (
  -- Descartables consumidos por venta. producto_descartables.qty es cuantas
  -- unidades del descartable se usan por unidad de producto vendido — como
  -- el descartable esta en su misma unidad, no hay conversion.
  select pd.insumo_id,
    sum(md.ventas * pd.qty) as qty
  from movimientos_diarios md
  join producto_descartables pd on pd.producto_id = md.producto_id
  join dias_operativos d on d.id = md.dia_id
  left join last_ajuste la on la.insumo_id = pd.insumo_id
  where md.ventas > 0::numeric
    and (la.since is null or d.fecha >= la.since::date)
  group by pd.insumo_id
),
consumido as (
  -- Union por insumo: sumamos los dos consumos si el mismo insumo aparece
  -- tanto como ingrediente como descartable de distintos productos.
  select insumo_id, sum(qty) as qty from (
    select insumo_id, qty from consumido_ingredientes
    union all
    select insumo_id, qty from consumido_descartables
  ) x
  group by insumo_id
)
select
  i.id as insumo_id,
  i.tenant_id,
  i.unit::text as unit,
  coalesce(la.baseline, i.stock_inicial) + coalesce(c.qty, 0::numeric) as stock_referencia,
  coalesce(cons.qty, 0::numeric) as stock_consumido,
  coalesce(la.baseline, i.stock_inicial) + coalesce(c.qty, 0::numeric)
    - coalesce(cons.qty, 0::numeric) as stock_actual
from insumos i
left join last_ajuste la on la.insumo_id = i.id
left join comprado c on c.insumo_id = i.id
left join consumido cons on cons.insumo_id = i.id
where i.track_stock = true;
