-- Arrastre de stock en cascada y sin saltos.
--
-- Caso real (Empanadas de Carne, sept 2026): el 12/09 cerró con conteo 17 y
-- el 13/09 amaneció con 27. Convivían dos mecanismos que se pisaban:
--
--   1. cerrar_dia propagaba el conteo del día cerrado "al siguiente día
--      ABIERTO". Como los días se cierran fuera de orden (el 10/09 se cerró
--      DESPUÉS que el 11 y el 12), "el siguiente abierto" del 10 era el 13:
--      le pisó el 17 del 12 con el 27 del 10. Además lo hacía por producto (no
--      por grupo barra+salón), con conteo null -> 0 y sin respetar los ajustes
--      manuales.
--   2. sync_stock_inicial re-derivaba el día SOLO cuando alguien lo miraba, y
--      solo ese día: el 14 y el 15 quedaban heredando el valor viejo hasta que
--      alguien entrara a cada uno.
--
-- Ahora hay UNA regla: el stock_anterior de un día abierto (filas no manuales)
-- se re-deriva del día previo cada vez que cambia cualquier dato que lo
-- alimenta, en cascada hacia adelante, vía trigger. cerrar_dia deja de
-- propagar por su cuenta y llama a la misma cascada. La derivación en sí no
-- cambia (stock_arrastre_previo, 0069).

-- Re-deriva el stock_anterior de las filas NO manuales de todos los días
-- ABIERTOS posteriores a p_fecha, en orden cronológico (así cada día lee el
-- anterior ya corregido). Con p_producto_id limita a su grupo barra+salón.
create or replace function public.sync_stock_siguientes(
  p_tenant_id uuid,
  p_fecha date,
  p_producto_id uuid default null
) returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dia record;
  v_grupo uuid[];
  v_count integer;
  v_total integer := 0;
begin
  if p_producto_id is not null then
    select array_agg(p2.id) into v_grupo
    from public.productos p
    join public.productos p2 on p2.tenant_id = p.tenant_id
    where p.id = p_producto_id
      and (p2.id = p.id
           or (p.concepto_id is not null
               and p2.concepto_id = p.concepto_id
               and p.formato is distinct from 'menu'
               and p2.formato is distinct from 'menu'));
  end if;

  -- Bandera para que el trigger no vuelva a disparar la cascada por cada fila
  -- que actualizamos acá (la cascada ya cubre todos los días que siguen).
  perform set_config('magnolia.arrastre_en_curso', 'on', true);

  for v_dia in
    select id, fecha from public.dias_operativos
    where tenant_id = p_tenant_id and fecha > p_fecha and status = 'abierto'
    order by fecha
  loop
    with derivado as (
      select m2.id,
        coalesce(public.stock_arrastre_previo(p_tenant_id, m2.producto_id, v_dia.fecha), 0) as val
      from public.movimientos_diarios m2
      where m2.dia_id = v_dia.id
        and m2.stock_anterior_manual = false
        and (v_grupo is null or m2.producto_id = any (v_grupo))
    )
    update public.movimientos_diarios m
    set stock_anterior = d.val
    from derivado d
    where m.id = d.id
      and m.stock_anterior is distinct from d.val;
    get diagnostics v_count = row_count;
    v_total := v_total + v_count;
  end loop;

  perform set_config('magnolia.arrastre_en_curso', 'off', true);
  return v_total;
end;
$function$;

-- Interna: la llaman el trigger y cerrar_dia (ambos security definer). No se
-- expone por RPC porque no valida tenant.
revoke all on function public.sync_stock_siguientes(uuid, date, uuid) from public, anon, authenticated;

-- Trigger: cualquier cambio en un dato que alimenta el teórico (o en el conteo)
-- re-deriva los días abiertos que siguen para ese grupo de producto.
create or replace function public.movimientos_diarios_arrastre_trg()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_fecha date;
begin
  if pg_trigger_depth() > 1
     or coalesce(current_setting('magnolia.arrastre_en_curso', true), 'off') = 'on'
  then
    return null;
  end if;

  select tenant_id, fecha into v_tenant_id, v_fecha
  from public.dias_operativos where id = new.dia_id;
  if v_tenant_id is null then
    return null;
  end if;

  perform public.sync_stock_siguientes(v_tenant_id, v_fecha, new.producto_id);
  return null;
end;
$function$;

drop trigger if exists movimientos_diarios_arrastre on public.movimientos_diarios;
create trigger movimientos_diarios_arrastre
  after insert or update of stock_anterior, produccion, ventas, desperdicio, almuerzo, conteo_fisico
  on public.movimientos_diarios
  for each row execute function public.movimientos_diarios_arrastre_trg();

-- cerrar_dia: sin la propagación "al siguiente abierto". Cerrar no cambia
-- ningún dato de entrada, pero por las dudas dispara la cascada completa.
create or replace function public.cerrar_dia(p_dia_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_fecha date;
begin
  select tenant_id, fecha into v_tenant_id, v_fecha
  from public.dias_operativos
  where id = p_dia_id;

  if v_tenant_id not in (select public.current_tenant_ids()) then
    raise exception 'Acceso denegado';
  end if;

  update public.movimientos_diarios
  set
    stock_calculado = stock_anterior + produccion - ventas - desperdicio - almuerzo,
    diferencia      = case
                        when conteo_fisico is not null
                        then conteo_fisico - (stock_anterior + produccion - ventas - desperdicio - almuerzo)
                        else null
                      end
  where dia_id = p_dia_id;

  update public.dias_operativos
  set status    = 'cerrado',
      closed_at = now(),
      closed_by = auth.uid()
  where id = p_dia_id;

  perform public.sync_stock_siguientes(v_tenant_id, v_fecha, null);
end;
$function$;

-- Reparación: re-derivar todos los días abiertos de todos los tenants, en
-- orden, para dejar limpio lo que los mecanismos viejos dejaron desfasado.
do $$
declare
  v_tenant record;
begin
  for v_tenant in select id from public.tenants loop
    perform public.sync_stock_siguientes(v_tenant.id, date '1900-01-01', null);
  end loop;
end $$;
