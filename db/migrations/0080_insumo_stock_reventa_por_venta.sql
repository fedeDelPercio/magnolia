-- Los insumos que se compran hechos (reventa) se descuentan por VENTA.
--
-- Era el diseño de 0056 ("reventa = se compra hecho -> descuento por venta"),
-- pero 0062 reescribió insumo_stock para expandir sub-recetas y se perdió esa
-- parte: desde entonces la gaseosa, el agua, las paletas, etc. se descontaban
-- por PRODUCCIÓN, y en Operación casi nunca se carga producción de reventa.
-- Caso real (ajuste del 22/09 a 5/10): se vendieron 182 gaseosas y el stock
-- no bajó ninguna (368 en vez de ~186); Helado quedó en -9; Paleta Helada en 20
-- con 64 en la heladera. Simulado con esta regla: Gaseosa 186, Helado 16,
-- Paleta Helada 82, Muffins 22, Pote 500 g 17, Pastelitos 14, Vino 0. Los
-- insumos que no son de reventa no cambian.
--
-- Regla: un insumo es "de reventa" si es el insumo de la receta de algún
-- producto marcado es_reventa. Ese insumo sale del stock cuando el producto
-- sale del local: VENTAS + DESPERDICIO + ALMUERZO de cualquier producto cuya
-- receta lo lleve (el producto suelto, su variante barra, un menú o una promo),
-- y deja de descontarse por producción. El resto de los ingredientes sigue
-- igual (por producción) y los descartables también (por venta).
--
-- Variantes sin receta: si un producto de reventa tiene la receta vacía (pasa
-- con "Helado", "Muffins Delivery", "Copa Vino": la receta quedó cargada en
-- otra variante), se usa la receta de una variante ACTIVA de reventa del mismo
-- producto (concepto), prefiriendo la base. Sin esto sus ventas no descontaban
-- nada. Solo para productos de reventa: un plato cocinado con receta vacía no
-- toma la de otra variante.
--
-- insumo_usado_en (ficha del insumo, "Usado en") aplica la misma regla para
-- que el desglose sume lo mismo que el stock.

create or replace view public.insumo_stock
with (security_invoker = true)
as
with last_ajuste as (
  select distinct on (insumo_stock_ajustes.insumo_id) insumo_stock_ajustes.insumo_id,
    insumo_stock_ajustes.stock_real as baseline,
    insumo_stock_ajustes.created_at as since
  from insumo_stock_ajustes
  order by insumo_stock_ajustes.insumo_id, insumo_stock_ajustes.created_at desc
), comprado as (
  select ci.insumo_id,
    sum(normalize_qty(ci.qty, ci.unit::text, i1.unit::text)) as qty
  from compra_items ci
    join insumos i1 on i1.id = ci.insumo_id
    left join last_ajuste la_1 on la_1.insumo_id = ci.insumo_id
  where la_1.since is null or ci.created_at > la_1.since
  group by ci.insumo_id
), receta_reventa as (
  select p.id as producto_id,
    coalesce(
      case when exists (select 1 from receta_ingredientes ri where ri.receta_id = p.receta_id)
        then p.receta_id end,
      case when p.es_reventa and p.concepto_id is not null then (
        select p2.receta_id
        from productos p2
        where p2.concepto_id = p.concepto_id
          and p2.id <> p.id
          and p2.active
          and p2.es_reventa
          and exists (select 1 from receta_ingredientes ri where ri.receta_id = p2.receta_id)
        order by (p2.canal is null and p2.formato is distinct from 'menu') desc,
          (p2.formato is distinct from 'menu') desc,
          p2.id
        limit 1
      ) end
    ) as receta_id
  from productos p
), reventa_insumos as (
  select distinct e.insumo_id
  from productos p
    cross join lateral receta_insumos_expandido(p.receta_id) e(insumo_id, qty)
  where p.es_reventa and p.receta_id is not null
), consumido_ingredientes as (
  select exp.insumo_id,
    sum(md.produccion / nullif(r.yield_qty, 0::numeric) * exp.qty) as qty
  from movimientos_diarios md
    join productos p on p.id = md.producto_id
    join recetas r on r.id = p.receta_id
    join dias_operativos d on d.id = md.dia_id
    cross join lateral receta_insumos_expandido(p.receta_id) exp(insumo_id, qty)
    left join last_ajuste la_1 on la_1.insumo_id = exp.insumo_id
  where md.produccion > 0::numeric
    and (la_1.since is null or d.fecha >= la_1.since::date)
    and not (exp.insumo_id in (select reventa_insumos.insumo_id from reventa_insumos))
  group by exp.insumo_id
), consumido_reventa as (
  select exp.insumo_id,
    sum((md.ventas + md.desperdicio + md.almuerzo) / nullif(r.yield_qty, 0::numeric) * exp.qty) as qty
  from movimientos_diarios md
    join receta_reventa rr on rr.producto_id = md.producto_id
    join recetas r on r.id = rr.receta_id
    join dias_operativos d on d.id = md.dia_id
    cross join lateral receta_insumos_expandido(rr.receta_id) exp(insumo_id, qty)
    left join last_ajuste la_1 on la_1.insumo_id = exp.insumo_id
  where (md.ventas + md.desperdicio + md.almuerzo) > 0::numeric
    and (la_1.since is null or d.fecha >= la_1.since::date)
    and exp.insumo_id in (select reventa_insumos.insumo_id from reventa_insumos)
  group by exp.insumo_id
), consumido_descartables as (
  select pd.insumo_id,
    sum(md.ventas * pd.qty) as qty
  from movimientos_diarios md
    join producto_descartables pd on pd.producto_id = md.producto_id
    join dias_operativos d on d.id = md.dia_id
    left join last_ajuste la_1 on la_1.insumo_id = pd.insumo_id
  where md.ventas > 0::numeric and (la_1.since is null or d.fecha >= la_1.since::date)
  group by pd.insumo_id
), consumido as (
  select x.insumo_id, sum(x.qty) as qty
  from (
    select consumido_ingredientes.insumo_id, consumido_ingredientes.qty from consumido_ingredientes
    union all
    select consumido_reventa.insumo_id, consumido_reventa.qty from consumido_reventa
    union all
    select consumido_descartables.insumo_id, consumido_descartables.qty from consumido_descartables
  ) x
  group by x.insumo_id
)
select i.id as insumo_id,
  i.tenant_id,
  i.unit::text as unit,
  coalesce(la.baseline, i.stock_inicial) + coalesce(c.qty, 0::numeric) as stock_referencia,
  coalesce(cons.qty, 0::numeric) as stock_consumido,
  coalesce(la.baseline, i.stock_inicial) + coalesce(c.qty, 0::numeric) - coalesce(cons.qty, 0::numeric) as stock_actual
from insumos i
  left join last_ajuste la on la.insumo_id = i.id
  left join comprado c on c.insumo_id = i.id
  left join consumido cons on cons.insumo_id = i.id
where i.track_stock = true;

create or replace function public.insumo_usado_en(p_insumo_id uuid)
 returns table(producto_id uuid, producto_name text, via text, qty_por_unidad numeric, consumido numeric)
 language sql
 stable
 set search_path to 'public'
as $function$
with la as (
  select created_at from insumo_stock_ajustes
  where insumo_id = p_insumo_id
  order by created_at desc limit 1
),
-- Mismo criterio que insumo_stock: si es insumo de reventa, se consume por
-- venta + desperdicio + almuerzo, con la receta efectiva (ver receta_reventa).
receta_reventa as (
  select p.id as producto_id,
    coalesce(
      case when exists (select 1 from receta_ingredientes ri where ri.receta_id = p.receta_id)
        then p.receta_id end,
      case when p.es_reventa and p.concepto_id is not null then (
        select p2.receta_id
        from productos p2
        where p2.concepto_id = p.concepto_id
          and p2.id <> p.id
          and p2.active
          and p2.es_reventa
          and exists (select 1 from receta_ingredientes ri where ri.receta_id = p2.receta_id)
        order by (p2.canal is null and p2.formato is distinct from 'menu') desc,
          (p2.formato is distinct from 'menu') desc,
          p2.id
        limit 1
      ) end
    ) as receta_id
  from productos p
),
es_reventa as (
  select exists (
    select 1 from productos p
    cross join lateral public.receta_insumos_expandido(p.receta_id) e
    where p.es_reventa and p.receta_id is not null and e.insumo_id = p_insumo_id
  ) as v
),
receta_uso as (
  select p.id, p.name, r.yield_qty, exp.qty
  from productos p
  join receta_reventa rr on rr.producto_id = p.id
  join recetas r on r.id = case when (select v from es_reventa) then rr.receta_id else p.receta_id end
  cross join lateral public.receta_insumos_expandido(r.id) exp
  where exp.insumo_id = p_insumo_id
),
receta_consumo as (
  select md.producto_id,
    sum((case when (select v from es_reventa) then md.ventas + md.desperdicio + md.almuerzo else md.produccion end
         / nullif(r.yield_qty, 0::numeric)) * exp.qty) as qty
  from movimientos_diarios md
  join receta_reventa rr on rr.producto_id = md.producto_id
  join productos p on p.id = md.producto_id
  join recetas r on r.id = case when (select v from es_reventa) then rr.receta_id else p.receta_id end
  join dias_operativos d on d.id = md.dia_id
  cross join lateral public.receta_insumos_expandido(r.id) exp
  where exp.insumo_id = p_insumo_id
    and (case when (select v from es_reventa) then md.ventas + md.desperdicio + md.almuerzo else md.produccion end) > 0::numeric
    and (not exists (select 1 from la) or d.fecha >= (select created_at::date from la))
  group by md.producto_id
),
desc_uso as (
  select p.id, p.name, pd.qty
  from producto_descartables pd
  join productos p on p.id = pd.producto_id
  where pd.insumo_id = p_insumo_id
),
desc_consumo as (
  select md.producto_id, sum(md.ventas * pd.qty) as qty
  from movimientos_diarios md
  join producto_descartables pd on pd.producto_id = md.producto_id
  join dias_operativos d on d.id = md.dia_id
  where pd.insumo_id = p_insumo_id
    and md.ventas > 0::numeric
    and (not exists (select 1 from la) or d.fecha >= (select created_at::date from la))
  group by md.producto_id
)
select ru.id, ru.name, 'receta'::text,
       ru.qty / greatest(coalesce(ru.yield_qty, 1), 0.001),
       coalesce(rc.qty, 0::numeric)
from receta_uso ru
left join receta_consumo rc on rc.producto_id = ru.id
union all
select du.id, du.name, 'descartable'::text, du.qty, coalesce(dc.qty, 0::numeric)
from desc_uso du
left join desc_consumo dc on dc.producto_id = du.id
$function$;
