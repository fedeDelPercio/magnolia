-- Arreglos pedidos por Caro (Magnolia Demo) — 2026-10-23
--
-- A) Vacaciones de Meli y Sofi: se cargaron "hasta el 26/10", pero el 26 es el
--    día que vuelven. Son 7 días: último día el 25/10. (Desde ahora el diálogo
--    pide "Vuelve a trabajar" y guarda el día anterior.)
-- B) Carrefour: la deuda quedó desfasada (compra del 12/03 por $14.751,14 sin
--    pagar). Se salda con un pago de ajuste que NO mueve la caja: el disparador
--    pago_to_caja crea el egreso y acá se borra en la misma transacción.
-- C) Vero: no tenía horario y nunca se le generó el sueldo al cerrar el día.
--    Se carga su sueldo ($33.000, liquidación + egreso en caja, igual que
--    generarPagosDelDia) en cada día cerrado en que se les pagó a los demás,
--    de lunes a sábado, desde que arrancó el sistema (25/07) hasta el 17/10.
--    Desde el 19/10 ya cobra sola.
-- D) Productos de reventa que no descontaban stock: tienen un insumo con el
--    mismo nombre y control de stock, pero la receta no existía o estaba vacía.
--    Se vinculan 1 a 1 (como Agua) y se marcan como reventa. Helado no: ya
--    descontaba por la receta del Menú Helado.

begin;

do $$
declare
  demo constant uuid := '2eaa43e4-d06d-4568-bcb3-1720587eddac';
  carrefour constant uuid := 'd48c3a2b-0662-4d2e-9f0d-f72cc0f8101b';
  compra_desfasada constant uuid := 'e7e4296f-e00e-436c-9c28-f3f102d19817';
  productos_reventa constant text[] := array[
    -- sin receta
    'Bandeja de Masitas', 'Bandeja de Mini Maicena', 'Bandeja de Palmeritas', 'Cuadrado de Brownie',
    'Mini Balcarce', 'Mini Crumble', 'Mini Marquise', 'Mini Pastafrola', 'Mini Torta de Ricota',
    -- receta vacía
    'Bombon Helado Caja', 'Bombón Helado Pistacho', 'Lemon Pie', 'Lingotes', 'Mini Cheese Cake',
    'Mini Sacher', 'Mini Selva Negra', 'Torta Helada'
  ];
  vero uuid;
  sueldo numeric;
  pago uuid;
  liq uuid;
  mov uuid;
  dia date;
  par record;
  rec uuid;
  n integer;
begin
  -- A) Vacaciones
  update public.empleado_vacaciones set fecha_hasta = '2026-10-25'
   where tenant_id = demo and id in ('0efb2afa-6969-4960-ae70-3796748fc539', '6d81b89c-8884-4776-8644-71349c60d5e5')
     and fecha_desde = '2026-10-19' and fecha_hasta = '2026-10-26';
  get diagnostics n = row_count;
  if n <> 2 then raise exception 'A: se esperaban 2 tomas (Meli y Sofi), hubo %', n; end if;

  -- B) Carrefour
  if (select status from public.compras where id = compra_desfasada and proveedor_id = carrefour) <> 'pendiente' then
    raise exception 'B: la compra del 12/03 ya no está pendiente';
  end if;
  insert into public.pagos_proveedor (tenant_id, proveedor_id, fecha, monto, metodo, descripcion, compra_id)
  select demo, carrefour, '2026-10-23', c.total, 'otro', 'Ajuste: deuda desfasada (sin movimiento de caja)', c.id
    from public.compras c where c.id = compra_desfasada
  returning id into pago;
  delete from public.caja_movimientos where tenant_id = demo and ref_kind = 'pago_proveedor' and ref_id = pago;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'B: se esperaba 1 egreso automático para borrar, hubo %', n; end if;
  update public.compras set status = 'pagada' where id = compra_desfasada;
  if (select total_compras - total_pagado from public.saldos_proveedores where id = carrefour) <> 0 then
    raise exception 'B: la deuda de Carrefour no quedó en cero';
  end if;

  -- C) Sueldos de Vero
  select id, sueldo_diario into strict vero, sueldo from public.empleados where tenant_id = demo and name = 'Vero' and activo;
  n := 0;
  for dia in
    select distinct l.fecha_desde
      from public.empleado_liquidaciones l
      join public.empleados e on e.id = l.empleado_id
     where e.tenant_id = demo and e.id <> vero
       and l.fecha_desde = l.fecha_hasta
       and l.fecha_desde between '2026-07-25' and '2026-10-18'
       and extract(dow from l.fecha_desde) between 1 and 6
       and not exists (select 1 from public.empleado_liquidaciones v
                        where v.empleado_id = vero and v.fecha_desde <= l.fecha_desde and v.fecha_hasta >= l.fecha_desde)
     order by 1
  loop
    insert into public.empleado_liquidaciones
      (empleado_id, tenant_id, fecha_desde, fecha_hasta, dias_programados, dias_trabajados,
       dias_ausentes_pagos, monto_sueldo, monto_plus, monto_descuentos, notas)
    values (vero, demo, dia, dia, 1, 1, 0, sueldo, 0, 0, 'Cargado el 23/10: no tenía horario y no se había generado')
    returning id into liq;
    insert into public.caja_movimientos (tenant_id, fecha, tipo, categoria, monto, descripcion, ref_kind, ref_id)
    values (demo, dia, 'egreso', 'Sueldos', sueldo, 'Sueldo de Vero', 'liquidacion_empleado', liq)
    returning id into mov;
    update public.empleado_liquidaciones set caja_movimiento_id = mov where id = liq;
    n := n + 1;
  end loop;
  if n <> 69 then raise exception 'C: se esperaban 69 días de sueldo de Vero, hubo %', n; end if;

  -- D) Reventa 1 a 1
  n := 0;
  for par in
    select p.id producto_id, p.name, p.receta_id, i.id insumo_id, i.unit
      from public.productos p
      join public.insumos i on i.tenant_id = p.tenant_id and lower(trim(i.name)) = lower(trim(p.name))
     where p.tenant_id = demo and p.name = any(productos_reventa) and i.track_stock
       and (p.receta_id is null or not exists (select 1 from public.receta_ingredientes ri where ri.receta_id = p.receta_id))
  loop
    rec := par.receta_id;
    if rec is null then
      insert into public.recetas (tenant_id, name, yield_qty, yield_unit) values (demo, par.name, 1, 'u') returning id into rec;
    end if;
    insert into public.receta_ingredientes (receta_id, kind, insumo_id, qty, unit) values (rec, 'insumo', par.insumo_id, 1, par.unit);
    update public.productos set receta_id = rec, es_reventa = true, updated_at = now() where id = par.producto_id;
    n := n + 1;
  end loop;
  if n <> 17 then raise exception 'D: se esperaban 17 productos para vincular, hubo %', n; end if;
end $$;

commit;
