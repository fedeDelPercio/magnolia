-- Exponer productos.es_reventa (agregado en 0056) a traves de la vista
-- product_costs, que es la que consume el catalogo de productos. Sin esto el
-- dialog no puede saber si un producto es de reventa al abrirlo.
-- Mantiene security_invoker=true (0050).

create or replace view public.product_costs
with (security_invoker = true)
as
select p.id,
  p.tenant_id,
  p.name,
  p.sale_price,
  p.receta_id,
  r.name as receta_name,
  p.target_margin_pct,
  p.is_dynamic,
  p.active,
  p.concepto_id,
  p.canal,
  p.formato,
  coalesce(
    case
      when p.receta_id is not null and r.yield_qty > 0::numeric then recipe_cost(p.receta_id) / r.yield_qty
      else 0::numeric
    end, 0::numeric) as ingredient_cost,
  coalesce(( select sum(pd.qty * i.current_price) as sum
         from producto_descartables pd
           join insumos i on i.id = pd.insumo_id
        where pd.producto_id = p.id), 0::numeric) as descartable_cost,
  coalesce(
    case
      when p.receta_id is not null and r.yield_qty > 0::numeric then recipe_cost(p.receta_id) / r.yield_qty
      else 0::numeric
    end, 0::numeric) + coalesce(( select sum(pd.qty * i.current_price) as sum
         from producto_descartables pd
           join insumos i on i.id = pd.insumo_id
        where pd.producto_id = p.id), 0::numeric) as total_cost,
  case
    when p.sale_price > 0::numeric then round((1::numeric - (coalesce(
      case
        when p.receta_id is not null and r.yield_qty > 0::numeric then recipe_cost(p.receta_id) / r.yield_qty
        else 0::numeric
      end, 0::numeric) + coalesce(( select sum(pd.qty * i.current_price) as sum
         from producto_descartables pd
           join insumos i on i.id = pd.insumo_id
        where pd.producto_id = p.id), 0::numeric)) / p.sale_price) * 100::numeric, 2)
    else 0::numeric
  end as margin_pct,
  p.es_reventa
from productos p
  left join recetas r on r.id = p.receta_id;
