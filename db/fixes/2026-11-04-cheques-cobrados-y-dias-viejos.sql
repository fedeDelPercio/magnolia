-- Cheques vencidos como cobrados y cierre de días viejos (Magnolia Demo) — 2026-11-04
--
-- 1) Cheques: nunca se marcó ninguno como cobrado, así que figuraban 142
--    vencidos pendientes (Luchador y Distribuidora Carlos, desde julio). Se
--    marcan cobrados en su fecha de vencimiento. Uno tenía vencimiento "año 8"
--    (pago del 02/09/2026): se corrige a 25/09/2026. Solo cambia cómo se ven
--    (Proveedores, Caja, Alertas); no mueve plata.
-- 2) Días: se cierran los días abiertos de antes del arranque (01/06 al 24/07)
--    y cuatro domingos sueltos (26/07, 09/08, 06/09, 25/10), igual que cerrar_dia
--    pero SIN generar sueldos (antes del arranque no se pagaban por el sistema;
--    los domingos nadie tiene horario). No se tocan 27, 28, 29 y 31/07: son
--    días hábiles sin sueldos generados, a decidir.
--    Control: el stock de los días que siguen abiertos no puede cambiar.

begin;

do $$
declare
  demo constant uuid := '2eaa43e4-d06d-4568-bcb3-1720587eddac';
  dia record;
  n integer;
begin
  -- 1) Cheques
  update public.pagos_proveedor set due_date = '2026-09-25'
   where id = 'f1f14340-8a74-4453-9d60-fc9777d6ed57' and tenant_id = demo and due_date = '0008-09-25';
  get diagnostics n = row_count;
  if n <> 1 then raise exception '1: se esperaba 1 cheque con fecha "año 8", hubo %', n; end if;

  update public.pagos_proveedor set cleared_at = due_date
   where tenant_id = demo and metodo = 'cheque' and cleared_at is null and due_date < current_date;
  get diagnostics n = row_count;
  if n < 140 or n > 150 then raise exception '1: se esperaban ~142 cheques vencidos, hubo %', n; end if;

  -- 2) Días viejos
  create temp table stock_antes on commit drop as
  select m.id, m.stock_anterior
    from public.movimientos_diarios m
    join public.dias_operativos d on d.id = m.dia_id
   where d.tenant_id = demo and d.status = 'abierto' and d.fecha >= '2026-07-25'
     and d.fecha not in ('2026-07-26', '2026-08-09', '2026-09-06', '2026-10-25');

  n := 0;
  for dia in
    select id, fecha from public.dias_operativos
     where tenant_id = demo and status = 'abierto'
       and (fecha < '2026-07-25' or fecha in ('2026-07-26', '2026-08-09', '2026-09-06', '2026-10-25'))
     order by fecha
  loop
    update public.movimientos_diarios
       set stock_calculado = stock_anterior + produccion - ventas - desperdicio - almuerzo,
           diferencia = case when conteo_fisico is not null
                             then conteo_fisico - (stock_anterior + produccion - ventas - desperdicio - almuerzo)
                             else null end
     where dia_id = dia.id;
    update public.dias_operativos set status = 'cerrado', closed_at = now() where id = dia.id;
    perform public.sync_stock_siguientes(demo, dia.fecha, null);
    n := n + 1;
  end loop;
  if n <> 54 then raise exception '2: se esperaban 54 días para cerrar, hubo %', n; end if;

  select count(*) into n
    from stock_antes a join public.movimientos_diarios m on m.id = a.id
   where m.stock_anterior is distinct from a.stock_anterior;
  if n <> 0 then raise exception '2: cambió el stock de % filas de días abiertos', n; end if;

  if exists (select 1 from public.stock_arrastre_desfasado) then
    raise exception '2: quedó arrastre de stock desfasado';
  end if;
end $$;

commit;
