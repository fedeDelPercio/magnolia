-- "Usado en": qué productos contienen un insumo (via receta expandida o como
-- descartable) o una sub-receta (directa o anidada), con la apertura de cuánto
-- del consumo de stock corresponde a cada producto.
--
-- insumo_usado_en: reusa receta_insumos_expandido (0062) — misma semántica que
-- la vista insumo_stock, y la ventana de consumo también es la misma (desde el
-- último ajuste de stock), así los números cierran con "stock consumido".
--
-- receta_usada_en: sube recursivamente desde la sub-receta hasta los productos
-- que la contienen (sub-receta dentro de sub-receta incluida). El consumo acá
-- es de los últimos 30 días (las sub-recetas no tienen ajustes de stock que
-- definan una ventana natural).

create or replace function public.insumo_usado_en(p_insumo_id uuid)
returns table(
  producto_id uuid,
  producto_name text,
  via text,
  qty_por_unidad numeric,
  consumido numeric
)
language sql
stable
set search_path to 'public'
as $function$
with la as (
  select created_at from insumo_stock_ajustes
  where insumo_id = p_insumo_id
  order by created_at desc limit 1
),
receta_uso as (
  select p.id, p.name, r.yield_qty, exp.qty
  from productos p
  join recetas r on r.id = p.receta_id
  cross join lateral public.receta_insumos_expandido(p.receta_id) exp
  where exp.insumo_id = p_insumo_id
),
receta_consumo as (
  select md.producto_id, sum((md.produccion / nullif(r.yield_qty, 0::numeric)) * exp.qty) as qty
  from movimientos_diarios md
  join productos p on p.id = md.producto_id
  join recetas r on r.id = p.receta_id
  join dias_operativos d on d.id = md.dia_id
  cross join lateral public.receta_insumos_expandido(p.receta_id) exp
  where exp.insumo_id = p_insumo_id
    and md.produccion > 0::numeric
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

create or replace function public.receta_usada_en(p_receta_id uuid)
returns table(
  producto_id uuid,
  producto_name text,
  qty_por_unidad numeric,
  consumido_30d numeric
)
language sql
stable
set search_path to 'public'
as $function$
with recursive uso as (
  -- qty_sub = cantidad de la sub-receta objetivo por UN batch de la receta padre
  select ri.receta_id, ri.qty::numeric as qty_sub, 0 as depth
  from receta_ingredientes ri
  where ri.sub_receta_id = p_receta_id and ri.kind = 'receta'
  union all
  select ri2.receta_id,
         u.qty_sub * (ri2.qty / greatest(coalesce(rmid.yield_qty, 1), 0.001)),
         u.depth + 1
  from uso u
  join recetas rmid on rmid.id = u.receta_id
  join receta_ingredientes ri2 on ri2.sub_receta_id = u.receta_id and ri2.kind = 'receta'
  where u.depth < 10
),
por_producto as (
  select p.id, p.name, sum(u.qty_sub / greatest(coalesce(r.yield_qty, 1), 0.001)) as qty_por_unidad
  from uso u
  join productos p on p.receta_id = u.receta_id
  join recetas r on r.id = u.receta_id
  group by p.id, p.name
)
select pp.id, pp.name, pp.qty_por_unidad,
  coalesce((
    select sum(md.produccion) * pp.qty_por_unidad
    from movimientos_diarios md
    join dias_operativos d on d.id = md.dia_id
    where md.producto_id = pp.id
      and md.produccion > 0::numeric
      and d.fecha >= (current_date - 30)
  ), 0::numeric)
from por_producto pp
$function$;
