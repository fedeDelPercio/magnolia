-- Anular pagos de proveedores y cargar el horario de Vero (Magnolia Demo) — 2026-10-20
--
-- 1) Pagos anulados (pedido de Caro), igual que el botón "Anular": se borra el
--    pago y su egreso en Caja.
--    - Carrefour 18/06 $43.829: pago sin ninguna compra; era el saldo a favor.
--    - Cinco pagos cargados dos veces (con segundos de diferencia; desde la
--      versión de anular pagos ya no se puede pagar de más una compra). De cada
--      par queda uno.
--      Luchador 14/09 $95.754: los dos cheques tenían distinto vencimiento
--      (10/10 y 10/11); queda el de 10/11, cargado último (la corrección).
-- 2) Vero no tenía horario y al cerrar el día no se le pagaba el sueldo.
--    Lunes a sábado de 12 a 17. Los días ya cerrados no se tocan.
--
-- Copia de lo borrado: qa/evidencia-2026-10-13/backup-pagos-anulados-2026-10-20.json
-- (en Magnolia-bento, sin commitear).

begin;

do $$
declare
  demo constant uuid := '2eaa43e4-d06d-4568-bcb3-1720587eddac';
  pagos constant uuid[] := array[
    '6ab5963a-54a7-4b17-8b5e-762268619333',  -- Carrefour 18/06 $43.829 (sin compra)
    'a84964f0-8359-436d-9e52-9f329bdf822a',  -- Carrefour 31/08 $4.461,40 (repetido)
    '5ec2d075-1704-4d78-9bcd-5ebc9574bdb8',  -- Carrefour 22/09 $3.843 (repetido)
    '76b652ee-4f47-493e-a5f3-a3369fe9d802',  -- Luchador 07/08 cheque $7.182,60 (repetido)
    'fc090822-97ab-45bd-94c7-dc40e7c168d2',  -- Luchador 14/09 cheque $95.754, vence 10/10 (repetido)
    '78756f13-64e1-4e9a-83c7-0603fd7cf8e0'   -- Luchador 01/10 cheque $54.918,52 (repetido)
  ]::uuid[];
  compras_afectadas uuid[];
  vero uuid;
  n integer;
begin
  select array_agg(distinct compra_id) filter (where compra_id is not null) into compras_afectadas
    from public.pagos_proveedor where id = any(pagos);

  delete from public.caja_movimientos
   where tenant_id = demo and ref_kind = 'pago_proveedor' and ref_id = any(pagos);
  get diagnostics n = row_count;
  if n <> 6 then raise exception 'Se esperaban 6 egresos de caja, hubo %', n; end if;

  delete from public.pagos_proveedor where tenant_id = demo and id = any(pagos);
  get diagnostics n = row_count;
  if n <> 6 then raise exception 'Se esperaban 6 pagos, hubo %', n; end if;

  -- Las 5 compras siguen pagadas: les queda un pago por el total.
  select count(*) into n
    from public.compras c
   where c.id = any(compras_afectadas)
     and (c.status <> 'pagada'
          or (select coalesce(sum(p.monto), 0) from public.pagos_proveedor p where p.compra_id = c.id) <> c.total);
  if coalesce(array_length(compras_afectadas, 1), 0) <> 5 or n <> 0 then
    raise exception 'Las compras de los pagos repetidos no quedaron pagadas justo (% con diferencias)', n;
  end if;

  -- Horario de Vero
  select id into strict vero from public.empleados where tenant_id = demo and name = 'Vero' and activo;
  if exists (select 1 from public.empleado_horarios where empleado_id = vero) then
    raise exception 'Vero ya tiene horario cargado';
  end if;
  insert into public.empleado_horarios (empleado_id, tenant_id, dow, hora_inicio, hora_fin)
  select vero, demo, d, '12:00', '17:00' from generate_series(1, 6) d;
  get diagnostics n = row_count;
  if n <> 6 then raise exception 'Se esperaban 6 días de horario, hubo %', n; end if;
end $$;

commit;
