-- recipe_cost() hacia qty_receta * current_price sin convertir unidades. Cuando
-- la receta esta en gramos y el insumo esta en kilos (ej: 70g de muzzarella con
-- precio de $7138/kg), el resultado eran $499.702 en vez de $500 — 1000x
-- inflado. Con eso el food cost del mes se iba a $17M sobre $800k de ventas y
-- el margen operativo se rompia a −$15M.
--
-- Fix: aplicar factor de conversion cuando receta e insumo estan en el mismo
-- dominio (peso, volumen, docena). Cross-domain (u vs kg/g/l/ml) queda como
-- qty * price — es semanticamente ambiguo (¿cuanto pesa 1 cherry?) y hay que
-- arreglar la receta o el insumo caso por caso.

create or replace function public.recipe_cost(p_receta_id uuid)
returns numeric
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  v_cost   numeric := 0;
  v_row    record;
  v_factor numeric;
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
      r.yield_qty as sub_yield_qty
    from public.receta_ingredientes ri
    left join public.insumos i on i.id = ri.insumo_id
    left join public.recetas r on r.id = ri.sub_receta_id
    where ri.receta_id = p_receta_id
  loop
    if v_row.kind = 'insumo' then
      -- Factor: qty_en_receta_unit * v_factor = qty_en_insumo_unit
      v_factor := case
        when v_row.receta_unit = v_row.insumo_unit then 1
        -- Peso
        when v_row.receta_unit = 'g'  and v_row.insumo_unit = 'kg' then 0.001
        when v_row.receta_unit = 'kg' and v_row.insumo_unit = 'g'  then 1000
        -- Volumen
        when v_row.receta_unit = 'ml' and v_row.insumo_unit = 'l'  then 0.001
        when v_row.receta_unit = 'l'  and v_row.insumo_unit = 'ml' then 1000
        -- Docena
        when v_row.receta_unit = 'u'      and v_row.insumo_unit = 'docena' then 1.0/12
        when v_row.receta_unit = 'docena' and v_row.insumo_unit = 'u'      then 12
        -- Cross-domain (peso/volumen ↔ unidad): fallback qty * price.
        -- Semanticamente ambiguo; requiere ajustar la receta o el insumo.
        else 1
      end;
      v_cost := v_cost + v_row.qty * v_factor * coalesce(v_row.current_price, 0);
    else
      v_cost := v_cost + v_row.qty * (
        public.recipe_cost(v_row.sub_receta_id)
        / greatest(coalesce(v_row.sub_yield_qty, 1), 0.001)
      );
    end if;
  end loop;

  return v_cost;
end;
$function$;
