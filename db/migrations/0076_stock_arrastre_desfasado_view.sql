-- Vista de diagnóstico: filas de días ABIERTOS cuyo stock_anterior no coincide
-- con lo que hoy deriva del día previo (excluye los ajustes manuales). Con el
-- trigger de 0075 tiene que devolver SIEMPRE 0 filas; si devuelve algo, el
-- arrastre se rompió y hay que mirar por qué antes de tocar datos.
--
--   select * from public.stock_arrastre_desfasado;
create or replace view public.stock_arrastre_desfasado as
select
  d.tenant_id,
  d.fecha,
  p.name as producto,
  m.stock_anterior,
  coalesce(public.stock_arrastre_previo(d.tenant_id, m.producto_id, d.fecha), 0) as derivado,
  m.id as movimiento_id
from public.dias_operativos d
join public.movimientos_diarios m on m.dia_id = d.id
join public.productos p on p.id = m.producto_id
where d.status = 'abierto'
  and m.stock_anterior_manual = false
  and m.stock_anterior is distinct from
      coalesce(public.stock_arrastre_previo(d.tenant_id, m.producto_id, d.fecha), 0);
