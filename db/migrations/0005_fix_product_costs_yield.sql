-- 0005_fix_product_costs_yield.sql
-- Fix: la view product_costs no consideraba el yield_qty de la receta.
-- Antes: total_cost = recipe_cost(receta) + descartable
-- Ahora: total_cost = (recipe_cost(receta) / receta.yield_qty) + descartable
--
-- La receta tiene un yield (ej: rinde 140 empanadas). El producto consume
-- 1 unidad de la receta, no la receta entera. Sin esta corrección, productos
-- ligados a recetas con yield > 1 mostraban un costo total inflado por el
-- factor del yield.

create or replace view public.product_costs
with (security_invoker = true)
as
select
  p.id,
  p.tenant_id,
  p.name,
  p.sale_price,
  p.receta_id,
  r.name as receta_name,
  p.descartable_cost,
  p.target_margin_pct,
  p.is_dynamic,
  p.active,
  coalesce(
    case
      when p.receta_id is not null and r.yield_qty > 0
        then recipe_cost(p.receta_id) / r.yield_qty
      else 0::numeric
    end,
    0::numeric
  ) + p.descartable_cost as total_cost,
  case
    when p.sale_price > 0::numeric then
      round(
        (1::numeric - (
          coalesce(
            case
              when p.receta_id is not null and r.yield_qty > 0
                then recipe_cost(p.receta_id) / r.yield_qty
              else 0::numeric
            end,
            0::numeric
          ) + p.descartable_cost
        ) / p.sale_price) * 100::numeric,
        2
      )
    else 0::numeric
  end as margin_pct
from productos p
left join recetas r on r.id = p.receta_id;
