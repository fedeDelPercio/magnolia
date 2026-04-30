-- 0006_cerrar_dia_propagate.sql
-- Modifica cerrar_dia para que, al cerrar un día, propague el conteo_fisico
-- de cada producto al siguiente día abierto (si existe). Esto resuelve el
-- caso donde la dueña edita un día anterior y los días posteriores ya
-- estaban abiertos con stock_anterior incorrecto.
--
-- Solo actualizamos stock_anterior cuando es 0 en el destino, para no pisar
-- ediciones manuales.

create or replace function public.cerrar_dia(p_dia_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tenant_id uuid;
  v_fecha date;
  v_next_dia_id uuid;
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

  -- Propagar al siguiente día abierto (el más cercano por fecha)
  select id into v_next_dia_id
  from public.dias_operativos
  where tenant_id = v_tenant_id
    and fecha > v_fecha
    and status = 'abierto'
  order by fecha asc
  limit 1;

  if v_next_dia_id is not null then
    update public.movimientos_diarios m_next
    set stock_anterior = m_prev.conteo_fisico
    from public.movimientos_diarios m_prev
    where m_next.dia_id = v_next_dia_id
      and m_prev.dia_id = p_dia_id
      and m_next.producto_id = m_prev.producto_id
      and m_prev.conteo_fisico is not null
      and m_next.stock_anterior = 0;  -- No pisar valores ya editados manualmente
  end if;
end;
$function$;
