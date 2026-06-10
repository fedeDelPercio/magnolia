-- 0025_cierres_caja_active_sumativo.sql
--
-- Reescribe la vista cierres_caja_active para que las dos fuentes (API + PDF)
-- sean ACUMULATIVAS por día/local, no exclusivas.
--
-- Contexto del negocio: la clienta tiene dos equipos de Bistrosoft en el mismo
-- local físico por motivos impositivos. Equipo 1 sincroniza por API, equipo 2
-- carga PDFs. Las dos fuentes deben sumarse en el dashboard porque son ventas
-- legítimas de tickets distintos.
--
-- Cambio: el DISTINCT ON antes era (tenant, fecha, shop_code) y elegía uno
-- por precedencia (api > pdf). Ahora se amplía a incluir TODOS los buckets de
-- monto, así dos cierres del mismo día/local sólo se colapsan a uno cuando
-- son literalmente idénticos al centavo (caso típico: la clienta sube el
-- mismo PDF dos veces por error). Si difieren aunque sea $1, ambos sobreviven
-- y las queries del dashboard los suman naturalmente con sus .reduce().
--
-- Riesgo conocido: si API trae $100.000,00 y PDF trae $100.000,01 por
-- redondeo, se cuentan los dos = $200k. Aceptado: preferimos sumar de más
-- antes que perder data. Si emerge como problema real, se agrega tolerancia.
--
-- La vista cierre_caja_productos_active sigue heredando este filtro porque
-- joinea con cierres_caja_active.id — no hay que tocarla.

create or replace view public.cierres_caja_active as
select distinct on (
    tenant_id,
    fecha_cierre_local,
    coalesce(shop_code, ''),
    total_vendido,
    monto_efectivo,
    monto_tarjetas,
    monto_qr,
    monto_online,
    monto_cuenta_cliente,
    monto_mostrador,
    monto_salon,
    total_retiros,
    total_depositos
  )
  id,
  tenant_id,
  fecha_apertura,
  fecha_cierre,
  operador,
  razon_social,
  efectivo_apertura,
  efectivo_cierre,
  total_vendido,
  total_ventas,
  total_comandas,
  cantidad_comandas,
  cantidad_ventas,
  cubiertos,
  ticket_promedio,
  monto_efectivo,
  monto_tarjetas,
  monto_qr,
  monto_online,
  monto_cuenta_cliente,
  monto_mostrador,
  monto_salon,
  total_retiros,
  total_depositos,
  raw_payload,
  dia_operativo_id,
  created_at,
  updated_at,
  created_by,
  updated_by,
  source,
  shop_code,
  fecha_cierre_local
from public.cierres_caja
order by
  tenant_id,
  fecha_cierre_local,
  coalesce(shop_code, ''),
  total_vendido,
  monto_efectivo,
  monto_tarjetas,
  monto_qr,
  monto_online,
  monto_cuenta_cliente,
  monto_mostrador,
  monto_salon,
  total_retiros,
  total_depositos,
  -- En empate exacto (mismos buckets), preferimos API como representante.
  case source when 'api' then 0 when 'pdf' then 1 else 2 end;
