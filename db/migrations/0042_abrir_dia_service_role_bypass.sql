-- Mismo bypass que agregamos en 0037 (bistro_update_token) y 0031
-- (bistro_get_credentials): permitir que el cron (service_role, sin user
-- logueado) cree dias_operativos cuando linkea un cierre_caja API.
-- Antes fallaba silenciosamente con "Acceso denegado" y el cierre quedaba
-- huerfano (dia_operativo_id NULL), invisible en /operacion/[diaId].
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
    select coalesce(md.stock_calculado, 0) into v_stock_ant
    from public.movimientos_diarios md
    join public.dias_operativos d on d.id = md.dia_id
    where md.producto_id = v_prod.id
      and d.tenant_id    = p_tenant_id
      and d.status       = 'cerrado'
      and d.fecha        < p_fecha
    order by d.fecha desc
    limit 1;

    insert into public.movimientos_diarios (dia_id, producto_id, stock_anterior)
    values (v_dia_id, v_prod.id, coalesce(v_stock_ant, 0));
  end loop;

  return v_dia_id;
end;
$function$;
