-- 0007_cerrar_dia_propagate_always.sql
-- El stock_anterior siempre se deriva del día anterior cerrado: no es
-- editable manualmente. La propagación se hace siempre (sin condición de
-- "solo si está en 0"). Si el conteo_fisico del día cerrado es null,
-- se interpreta como 0.

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

  -- Propagar al siguiente día abierto: stock_anterior siempre se sobreescribe
  -- con el conteo_fisico del día recién cerrado (null -> 0).
  select id into v_next_dia_id
  from public.dias_operativos
  where tenant_id = v_tenant_id
    and fecha > v_fecha
    and status = 'abierto'
  order by fecha asc
  limit 1;

  if v_next_dia_id is not null then
    update public.movimientos_diarios m_next
    set stock_anterior = coalesce(m_prev.conteo_fisico, 0)
    from public.movimientos_diarios m_prev
    where m_next.dia_id = v_next_dia_id
      and m_prev.dia_id = p_dia_id
      and m_next.producto_id = m_prev.producto_id;
  end if;
end;
$function$;
