-- Percepciones (impuesto argentino que el proveedor factura por separado).
-- Es un monto en pesos que se suma al total de la compra pero NO afecta el
-- current_price del insumo — es un costo aparte que Caro paga, no un precio
-- unitario negociado.
--
-- Modelo:
--   compras.percepciones = monto en $ (default 0). Se ingresa a mano.
--   compras.total = suma(items con IVA + descuento) + percepciones.
--
-- El pct es solo un helper de UI para calcular el monto — no persiste en DB,
-- porque una vez guardado el monto ya no importa como lo obtuvo el usuario.

alter table public.compras
  add column if not exists percepciones numeric(12,2) not null default 0;

alter table public.compras
  drop constraint if exists compras_percepciones_check,
  add constraint compras_percepciones_check check (percepciones >= 0);

-- Actualiza el trigger para sumar percepciones al total. Idempotente.
create or replace function public.on_compra_item_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_compra_iva numeric(5,2);
  v_compra_descuento numeric(5,2);
  v_compra_percepciones numeric(12,2);
  v_iva_efectivo numeric(5,2);
  v_bruto_unit numeric;
begin
  select coalesce(iva_rate, 0), coalesce(descuento_pct, 0), coalesce(percepciones, 0)
    into v_compra_iva, v_compra_descuento, v_compra_percepciones
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
     ), 0) + v_compra_percepciones
   where c.id = new.compra_id;

  return new;
end;
$function$;

-- Recalcular totales existentes (todos quedan igual, percepciones=0, pero
-- deja el estado consistente con el nuevo trigger). Idempotente.
update public.compras c
   set total = coalesce(sub.total_calc, 0) + coalesce(c.percepciones, 0)
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
