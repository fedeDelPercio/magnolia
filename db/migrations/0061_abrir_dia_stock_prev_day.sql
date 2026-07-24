-- 0061_abrir_dia_stock_prev_day.sql
-- El stock inicial de un día se toma del día anterior SIN exigir que esté
-- cerrado: en la práctica los días quedan abiertos, así que atar la
-- propagación al cierre dejaba el stock_anterior en 0. Ahora se deriva del
-- último día previo (cualquier estado): el conteo físico si se cargó, y si no
-- el teórico calculado en vivo (stock_anterior + produccion - ventas -
-- desperdicio - almuerzo). Sigue siendo editable a mano después.
create or replace function public.abrir_dia(p_tenant_id uuid, p_fecha date)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dia_id uuid;
  v_prod   record;
  v_stock_ant numeric;
begin
  if auth.role() <> 'service_role'
     and p_tenant_id not in (select public.current_tenant_ids())
  then
    raise exception 'Acceso denegado';
  end if;

  insert into public.dias_operativos (tenant_id, fecha)
  values (p_tenant_id, p_fecha)
  returning id into v_dia_id;

  for v_prod in
    select id from public.productos
    where tenant_id = p_tenant_id and active = true
    order by name
  loop
    select coalesce(
             md.conteo_fisico,
             md.stock_anterior + md.produccion - md.ventas - md.desperdicio - md.almuerzo
           )
      into v_stock_ant
    from public.movimientos_diarios md
    join public.dias_operativos d on d.id = md.dia_id
    where md.producto_id = v_prod.id
      and d.tenant_id    = p_tenant_id
      and d.fecha        < p_fecha
    order by d.fecha desc
    limit 1;

    insert into public.movimientos_diarios (dia_id, producto_id, stock_anterior)
    values (v_dia_id, v_prod.id, coalesce(v_stock_ant, 0));
  end loop;

  return v_dia_id;
end;
$function$;

-- Re-sembrar a demanda el stock_anterior de un día abierto desde el día previo.
-- Se dispara con el botón "Traer stock del día anterior": sobreescribe el
-- stock_anterior de todas las filas (por eso el UI pide confirmación) usando el
-- conteo físico del día anterior, o su teórico en vivo si no se contó.
create or replace function public.resembrar_stock_inicial(p_dia_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_fecha date;
  v_status text;
begin
  select tenant_id, fecha, status into v_tenant_id, v_fecha, v_status
  from public.dias_operativos where id = p_dia_id;

  if v_tenant_id is null then
    raise exception 'Dia no encontrado';
  end if;
  if v_tenant_id not in (select public.current_tenant_ids()) then
    raise exception 'Acceso denegado';
  end if;
  if v_status <> 'abierto' then
    raise exception 'El dia esta cerrado';
  end if;

  update public.movimientos_diarios m
  set stock_anterior = coalesce((
    select coalesce(
             md.conteo_fisico,
             md.stock_anterior + md.produccion - md.ventas - md.desperdicio - md.almuerzo
           )
    from public.movimientos_diarios md
    join public.dias_operativos d on d.id = md.dia_id
    where md.producto_id = m.producto_id
      and d.tenant_id = v_tenant_id
      and d.fecha < v_fecha
    order by d.fecha desc
    limit 1
  ), 0)
  where m.dia_id = p_dia_id;
end;
$function$;
