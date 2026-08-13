-- Conversión de unidades al consumir SUB-RECETAS. Hasta ahora, si un producto
-- consumía "75 g" de una sub-receta cuyo rendimiento está en kg, el costo y la
-- explosión de stock multiplicaban 75 × (valor por KILO): 1000x de error.
-- Caso real: Empanadas de Carne con "Relleno de carne 75 g" costaba $875.925
-- en vez de $875,93. Se agrega normalize_qty (que ya convertía g/kg y ml/l,
-- ahora también u/docena) en los tres lugares que mezclan qty de línea con
-- rendimiento de sub-receta: recipe_cost, receta_insumos_expandido y
-- receta_usada_en. Las unidades de familias distintas (g vs porcion) siguen
-- sin convertirse — eso se marca como warning en la UI.

create or replace function public.normalize_qty(qty numeric, from_unit text, to_unit text)
returns numeric
language sql
immutable
as $function$
  select case
    when from_unit = to_unit then qty
    when from_unit = 'kg' and to_unit = 'g'  then qty * 1000
    when from_unit = 'g'  and to_unit = 'kg' then qty / 1000
    when from_unit = 'l'  and to_unit = 'ml' then qty * 1000
    when from_unit = 'ml' and to_unit = 'l'  then qty / 1000
    when from_unit = 'u'      and to_unit = 'docena' then qty / 12
    when from_unit = 'docena' and to_unit = 'u'      then qty * 12
    else qty
  end;
$function$;

create or replace function public.recipe_cost(p_receta_id uuid)
returns numeric
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_cost numeric := 0;
  v_row  record;
begin
  if p_receta_id is null then
    return 0;
  end if;

  for v_row in
    select
      ri.kind,
      ri.qty,
      ri.unit as receta_unit,
      i.current_price,
      i.unit  as insumo_unit,
      ri.sub_receta_id,
      r.yield_qty  as sub_yield_qty,
      r.yield_unit as sub_yield_unit
    from public.receta_ingredientes ri
    left join public.insumos i on i.id = ri.insumo_id
    left join public.recetas r on r.id = ri.sub_receta_id
    where ri.receta_id = p_receta_id
  loop
    if v_row.kind = 'insumo' then
      v_cost := v_cost
        + public.normalize_qty(v_row.qty, v_row.receta_unit::text, v_row.insumo_unit::text)
          * coalesce(v_row.current_price, 0);
    else
      -- qty convertida a la unidad del rendimiento de la sub-receta antes de
      -- multiplicar por su costo por unidad de rendimiento.
      v_cost := v_cost
        + public.normalize_qty(v_row.qty, v_row.receta_unit::text, v_row.sub_yield_unit::text)
          * (public.recipe_cost(v_row.sub_receta_id)
             / greatest(coalesce(v_row.sub_yield_qty, 1), 0.001));
    end if;
  end loop;

  return v_cost;
end;
$function$;

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
           e.mult * (normalize_qty(e.qty, e.unit::text, r.yield_unit::text)
                     / greatest(coalesce(r.yield_qty, 1), 0.001)),
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

create or replace function public.receta_usada_en(p_receta_id uuid)
returns table(producto_id uuid, producto_name text, qty_por_unidad numeric, consumido_30d numeric)
language sql
stable
set search_path to 'public'
as $function$
with recursive uso as (
  -- qty normalizada a la unidad de rendimiento de la receta consultada, así
  -- "75 g" de una receta con yield en kg cuenta como 0,075.
  select ri.receta_id,
         normalize_qty(ri.qty, ri.unit::text, r0.yield_unit::text)::numeric as qty_sub,
         0 as depth
  from receta_ingredientes ri
  join recetas r0 on r0.id = p_receta_id
  where ri.sub_receta_id = p_receta_id and ri.kind = 'receta'
  union all
  select ri2.receta_id,
         u.qty_sub * (normalize_qty(ri2.qty, ri2.unit::text, rmid.yield_unit::text)
                      / greatest(coalesce(rmid.yield_qty, 1), 0.001)),
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
