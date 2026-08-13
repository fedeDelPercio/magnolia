-- Arrastre de stock a nivel GRUPO barra+salón. Hasta ahora el stock_anterior se
-- derivaba por producto individual (conteo del día previo, o su teórico). Pero
-- la UI agrupa las variantes de canal de un concepto en una sola fila: el
-- stock/producción/conteo se guarda en la variante base y las ventas de Bistro
-- quedan repartidas por canal. Resultado: el teórico de la base ignoraba las
-- ventas Delivery (quedaban en la otra variante, cuyo teórico negativo se
-- cortaba en 0) y el stock arrastrado quedaba inflado. Caso real: Empanadas de
-- J y Q 11/8 (stock 28, ventas 3 base + 25 delivery, sin conteo) arrancó el
-- 12/8 con 25 en vez de 0.
--
-- stock_arrastre_previo(tenant, producto, fecha) espeja el agrupado de la UI
-- (mismo concepto_id, sin formato menú, primaria = canal null):
--   - variante base  -> conteo del grupo si se contó, si no teórico del grupo
--   - variante canal -> 0 (el stock del grupo vive en la base)
--   - sin concepto / menú / grupo sin base activa -> lógica por producto igual
--     que antes.
-- Sin security definer: hereda los privilegios del caller (las tres funciones
-- que lo usan ya son security definer y validan tenant).

create or replace function public.stock_arrastre_previo(
  p_tenant_id uuid,
  p_producto_id uuid,
  p_fecha date
) returns numeric
language sql
stable
set search_path to 'public'
as $function$
  with prod as (
    select p.id, p.concepto_id, p.canal, p.formato
    from public.productos p
    where p.id = p_producto_id
  ),
  clasif as (
    select prod.*,
      (prod.concepto_id is not null
        and prod.formato is distinct from 'menu'
        and exists (
          select 1 from public.productos pb
          where pb.concepto_id = prod.concepto_id
            and pb.canal is null
            and pb.formato is distinct from 'menu'
            and pb.active = true
        )) as agrupado
    from prod
  ),
  grupo as (
    -- Filas cuyo movimiento suma al arrastre: el grupo completo si el producto
    -- es la base de un grupo; solo él mismo en el resto de los casos.
    select p2.id
    from public.productos p2, clasif c
    where (c.agrupado and c.canal is null
           and p2.concepto_id = c.concepto_id
           and p2.formato is distinct from 'menu')
       or p2.id = c.id
  ),
  ultimo_dia as (
    select d.id
    from public.dias_operativos d
    where d.tenant_id = p_tenant_id
      and d.fecha < p_fecha
      and exists (
        select 1 from public.movimientos_diarios md
        join grupo g on g.id = md.producto_id
        where md.dia_id = d.id
      )
    order by d.fecha desc
    limit 1
  ),
  agg as (
    select
      case when bool_or(md.conteo_fisico is not null)
        then sum(coalesce(md.conteo_fisico, 0)) end as conteo,
      sum(md.stock_anterior + md.produccion - md.ventas - md.desperdicio - md.almuerzo) as teorico
    from public.movimientos_diarios md
    join grupo g on g.id = md.producto_id
    where md.dia_id = (select id from ultimo_dia)
  )
  select case
    when (select agrupado and canal is not null from clasif) then 0
    when (select id from ultimo_dia) is null then null
    else greatest(0, coalesce((select conteo from agg), (select teorico from agg)))
  end;
$function$;

create or replace function public.abrir_dia(p_tenant_id uuid, p_fecha date)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_dia_id uuid;
  v_prod   record;
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
    insert into public.movimientos_diarios (dia_id, producto_id, stock_anterior)
    values (
      v_dia_id,
      v_prod.id,
      coalesce(public.stock_arrastre_previo(p_tenant_id, v_prod.id, p_fecha), 0)
    );
  end loop;

  return v_dia_id;
end;
$function$;

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
      coalesce(public.stock_arrastre_previo(v_tenant_id, m2.producto_id, v_fecha), 0) as val
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
      stock_anterior = coalesce(
        public.stock_arrastre_previo(v_tenant_id, m.producto_id, v_fecha), 0)
  where m.dia_id = p_dia_id;
end;
$function$;
