-- La vista insumo_stock solo descontaba INGREDIENTES DIRECTOS (receta_ingredientes
-- con kind='insumo') por producción. Los productos armados con SUB-RECETAS
-- (kind='receta' via sub_receta_id: masa, relleno, mix de ensalada, etc.) no
-- descontaban nada de lo que hay adentro de esas sub-recetas — el stock de esos
-- insumos quedaba "lleno" aunque se produjera todos los días.
--
-- recipe_cost() ya bajaba recursivamente por las sub-recetas (0043), así que el
-- COSTO estaba bien pero el STOCK no. Este fix cierra esa asimetría.
--
-- 1) Función receta_insumos_expandido(receta_id): explota una receta hasta sus
--    insumos finales, con la misma semántica de sub-receta que recipe_cost
--    (qty / yield_sub por nivel) y conversión de unidad via normalize_qty.
-- 2) Vista insumo_stock: consumido_ingredientes usa esa expansión.

create or replace function public.receta_insumos_expandido(p_receta_id uuid)
returns table(insumo_id uuid, qty numeric)
language sql
stable
set search_path to 'public'
as $function$
  with recursive expand as (
    select ri.insumo_id, ri.sub_receta_id, ri.kind, ri.qty, ri.unit,
           1::numeric as mult, 0 as depth
    from receta_ingredientes ri
    where ri.receta_id = p_receta_id
    union all
    select ri.insumo_id, ri.sub_receta_id, ri.kind, ri.qty, ri.unit,
           e.mult * (e.qty / greatest(coalesce(r.yield_qty, 1), 0.001)),
           e.depth + 1
    from expand e
    join recetas r on r.id = e.sub_receta_id
    join receta_ingredientes ri on ri.receta_id = e.sub_receta_id
    where e.kind = 'receta' and e.depth < 10
  )
  select e.insumo_id,
         sum(e.mult * normalize_qty(e.qty, e.unit::text, i.unit::text)) as qty
  from expand e
  join insumos i on i.id = e.insumo_id
  where e.kind = 'insumo'
  group by e.insumo_id
$function$;

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
  -- Ingredientes consumidos por produccion, EXPANDIENDO recursivamente las
  -- sub-recetas hasta el insumo final.
  select exp.insumo_id,
    sum((md.produccion / nullif(r.yield_qty, 0::numeric)) * exp.qty) as qty
  from movimientos_diarios md
  join productos p on p.id = md.producto_id
  join recetas r on r.id = p.receta_id
  join dias_operativos d on d.id = md.dia_id
  cross join lateral public.receta_insumos_expandido(p.receta_id) exp
  left join last_ajuste la on la.insumo_id = exp.insumo_id
  where md.produccion > 0::numeric
    and (la.since is null or d.fecha >= la.since::date)
  group by exp.insumo_id
),
consumido_descartables as (
  -- Descartables consumidos por venta (sin cambios).
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
