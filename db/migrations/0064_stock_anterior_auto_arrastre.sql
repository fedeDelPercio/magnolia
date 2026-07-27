-- Arrastre automático del stock anterior: cada vez que se ve un día abierto, el
-- stock_anterior de las filas NO editadas a mano se re-deriva del día previo
-- (conteo físico, o teórico en vivo si no se contó; cortado en 0). Se agrega una
-- marca por fila para no pisar los ajustes manuales.

alter table public.movimientos_diarios
  add column if not exists stock_anterior_manual boolean not null default false;

-- Re-deriva el stock_anterior de las filas no-manuales de un día abierto desde
-- el día previo. Devuelve la cantidad de filas actualizadas (0 = nada cambió).
-- Se llama en cada lectura del día (getDia) para mantener el arrastre al día.
create or replace function public.sync_stock_inicial(p_dia_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id uuid;
  v_fecha date;
  v_status text;
  v_count integer;
begin
  select tenant_id, fecha, status into v_tenant_id, v_fecha, v_status
  from public.dias_operativos where id = p_dia_id;

  if v_tenant_id is null then
    return 0;
  end if;
  if v_tenant_id not in (select public.current_tenant_ids()) then
    raise exception 'Acceso denegado';
  end if;
  if v_status <> 'abierto' then
    return 0;
  end if;

  with derivado as (
    select m2.id,
      coalesce((
        select greatest(0, coalesce(
                 md.conteo_fisico,
                 md.stock_anterior + md.produccion - md.ventas - md.desperdicio - md.almuerzo
               ))
        from public.movimientos_diarios md
        join public.dias_operativos dd on dd.id = md.dia_id
        where md.producto_id = m2.producto_id
          and dd.tenant_id = v_tenant_id
          and dd.fecha < v_fecha
        order by dd.fecha desc
        limit 1
      ), 0) as val
    from public.movimientos_diarios m2
    where m2.dia_id = p_dia_id
      and m2.stock_anterior_manual = false
  )
  update public.movimientos_diarios m
  set stock_anterior = d.val
  from derivado d
  where m.id = d.id
    and m.stock_anterior is distinct from d.val;

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

-- El botón "Traer stock anterior" re-pull total: resetea la marca manual y
-- re-deriva todo (sobreescribe también ajustes manuales, por eso pide confirmación).
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
  set stock_anterior_manual = false,
      stock_anterior = coalesce((
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
