-- El grupo de un producto en Operación pasa a incluir su variante MENÚ.
--
-- Hasta acá el grupo era barra+salón y "Menú X" quedaba como fila aparte, con
-- su propio stock. Pero el menú no se produce aparte: es el mismo producto
-- vendido con otro armado. Resultado: una venta por menú no bajaba el stock del
-- producto, y Carolina lo compensaba a mano cargando en la fila "Menú X" una
-- producción igual a las ventas para que el teórico diera 0.
--
-- Ahora: una fila por producto. El stock/producción/conteo viven en la variante
-- base y las ventas de TODAS las variantes (salón, barra, menú) descuentan del
-- mismo stock. La derivación no cambia; solo cambia quién integra el grupo.
-- Los menús sin concepto o sin base activa siguen por producto, igual que antes.
--
-- El agrupado vive en tres lugares que tienen que coincidir:
--   - esta función + sync_stock_siguientes
--   - src/features/operations/grupos.ts (grilla del día y diferencias del mes)

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
      (prod.canal is null and prod.formato is distinct from 'menu') as es_base,
      (prod.concepto_id is not null
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
    -- Filas cuyo movimiento suma al arrastre: el grupo completo (incluye menú)
    -- si el producto es la base de un grupo; solo él mismo en el resto.
    select p2.id
    from public.productos p2, clasif c
    where (c.agrupado and c.es_base
           and p2.concepto_id = c.concepto_id)
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
    when (select agrupado and not es_base from clasif) then 0
    when (select id from ultimo_dia) is null then null
    else greatest(0, coalesce((select conteo from agg), (select teorico from agg)))
  end;
$function$;

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
               and p2.concepto_id = p.concepto_id));
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

revoke all on function public.sync_stock_siguientes(uuid, date, uuid) from public, anon, authenticated;

-- Backfill: re-derivar los días abiertos con la nueva definición de grupo.
do $$
declare
  v_t record;
begin
  for v_t in
    select tenant_id, min(fecha) as desde
    from public.dias_operativos
    group by tenant_id
  loop
    perform public.sync_stock_siguientes(v_t.tenant_id, v_t.desde - 1, null);
  end loop;
end $$;
