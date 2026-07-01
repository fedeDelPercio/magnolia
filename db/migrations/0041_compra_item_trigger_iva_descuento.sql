-- Actualiza el trigger on_compra_item_insert para que aplique el
-- descuento_pct de la compra y el IVA (por linea si esta seteado, sino el
-- global de la compra) al calcular:
--   1) current_price del insumo (bruto que la duena realmente paga).
--   2) compras.total (suma de brutos con IVA + descuento por linea).
--
-- Formula por linea:
--   iva_efectivo    = coalesce(item.iva_rate, compra.iva_rate)
--   descontado_unit = unit_price * (1 - compra.descuento_pct/100)
--   bruto_unit      = descontado_unit * (1 + iva_efectivo/100)
--   total_linea     = qty * bruto_unit

create or replace function public.on_compra_item_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_compra_iva numeric(5,2);
  v_compra_descuento numeric(5,2);
  v_iva_efectivo numeric(5,2);
  v_bruto_unit numeric;
begin
  select coalesce(iva_rate, 0), coalesce(descuento_pct, 0)
    into v_compra_iva, v_compra_descuento
    from public.compras
   where id = new.compra_id;

  v_iva_efectivo := coalesce(new.iva_rate, v_compra_iva);
  v_bruto_unit := new.unit_price * (1 - v_compra_descuento/100) * (1 + v_iva_efectivo/100);

  update public.insumos
     set current_price = v_bruto_unit
   where id = new.insumo_id;

  update public.compras c
     set total = coalesce((
       select sum(
         ci.qty * ci.unit_price
                * (1 - v_compra_descuento/100)
                * (1 + coalesce(ci.iva_rate, v_compra_iva)/100)
       )
       from public.compra_items ci
       where ci.compra_id = new.compra_id
     ), 0)
   where c.id = new.compra_id;

  return new;
end;
$function$;

-- Recalcular totales existentes (todas las compras vigentes) para que reflejen
-- IVA + descuento con el nuevo modelo. Idempotente.
update public.compras c
   set total = coalesce(sub.total_calc, 0)
  from (
    select ci.compra_id,
           sum(
             ci.qty * ci.unit_price
                    * (1 - coalesce(cc.descuento_pct, 0)/100)
                    * (1 + coalesce(ci.iva_rate, cc.iva_rate, 0)/100)
           ) as total_calc
      from public.compra_items ci
      join public.compras cc on cc.id = ci.compra_id
     group by ci.compra_id
  ) as sub
 where c.id = sub.compra_id;
