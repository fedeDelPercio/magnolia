-- Feature: productos de "reventa" (se compran ya hechos, sin produccion propia).
-- Ej: gaseosas, agua, medialunas, muffins, alfajores comprados hechos.
--
-- Modelo:
--   - Un producto de reventa se vincula 1:1 a un insumo (el item que se compra
--     y se revende tal cual). La receta del producto tiene un unico ingrediente
--     insumo con qty = 1 (asi el costo del producto = precio del insumo, gratis,
--     reusando recipe_cost).
--   - Marca: productos.es_reventa = true.
--
-- Stock (extiende la logica de 0051):
--   ingrediente = se usa cuando cocinas   -> descuento por PRODUCCION
--   descartable = se usa cuando servis    -> descuento por VENTA
--   reventa     = se compra hecho         -> descuento por VENTA (1:1)
--
-- Por eso los productos de reventa se EXCLUYEN de consumido_ingredientes (sino
-- nunca descontarian, porque produccion=0 en reventa) y se agregan en un CTE
-- nuevo consumido_reventa que descuenta por venta.

alter table public.productos
  add column if not exists es_reventa boolean not null default false;

comment on column public.productos.es_reventa is
  'Producto que se compra ya hecho y se revende tal cual (sin produccion). '
  'Su receta tiene un unico insumo 1:1 que se descuenta del stock por VENTA.';

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
  -- Ingredientes de receta consumidos por produccion. Excluimos productos de
  -- reventa: esos no se cocinan y se descuentan por venta (ver consumido_reventa).
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
    and p.es_reventa is not true
    and (la.since is null or d.fecha >= la.since::date)
  group by ri.insumo_id
),
consumido_descartables as (
  -- Descartables consumidos por venta.
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
consumido_reventa as (
  -- Productos de reventa: el insumo se consume cuando se VENDE el producto (no
  -- cuando se cocina). La receta del producto de reventa tiene un unico
  -- ingrediente insumo con qty = 1, asi que descontamos md.ventas * qty.
  select ri.insumo_id,
    sum(md.ventas * normalize_qty(ri.qty, ri.unit::text, i1.unit::text)) as qty
  from movimientos_diarios md
  join productos p on p.id = md.producto_id and p.es_reventa = true
  join recetas r on r.id = p.receta_id
  join receta_ingredientes ri on ri.receta_id = r.id and ri.kind = 'insumo'::ingrediente_kind
  join insumos i1 on i1.id = ri.insumo_id
  join dias_operativos d on d.id = md.dia_id
  left join last_ajuste la on la.insumo_id = ri.insumo_id
  where md.ventas > 0::numeric
    and (la.since is null or d.fecha >= la.since::date)
  group by ri.insumo_id
),
consumido as (
  select insumo_id, sum(qty) as qty from (
    select insumo_id, qty from consumido_ingredientes
    union all
    select insumo_id, qty from consumido_descartables
    union all
    select insumo_id, qty from consumido_reventa
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
