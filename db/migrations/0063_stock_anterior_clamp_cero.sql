-- El arrastre de stock (0061) usaba el teórico del día previo como fallback
-- cuando no hubo conteo físico. Si un producto tuvo ventas sin producción ni
-- stock inicial (típico en reventa: agua, café), ese teórico da NEGATIVO y se
-- arrastraba como stock_anterior negativo al día siguiente. El stock físico no
-- puede ser < 0: un negativo ahí significa "0 / no sé cuánto quedó". Cortamos
-- en 0 con greatest(0, ...) en abrir_dia y resembrar_stock_inicial.

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
    select greatest(0, coalesce(
             md.conteo_fisico,
             md.stock_anterior + md.produccion - md.ventas - md.desperdicio - md.almuerzo
           ))
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
    select greatest(0, coalesce(
             md.conteo_fisico,
             md.stock_anterior + md.produccion - md.ventas - md.desperdicio - md.almuerzo
           ))
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
