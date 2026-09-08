-- Pagos de servicio pendientes.
--
-- La factura de un servicio (luz, internet, alquiler) llega antes de pagarse.
-- Hasta ahora sólo se podía registrar el pago ya hecho, así que la deuda vivía
-- en la cabeza de la user hasta que la pagaba. Ahora un pago se puede registrar
-- como 'pendiente' con su vencimiento y saldarse después, igual que las compras
-- de los proveedores de insumos.
--
-- Regla clave: un pendiente NO genera egreso en caja. El egreso se crea recién
-- al saldarlo, con la fecha real de pago (pagado_at) — si no, la caja mostraría
-- plata que todavía no salió.

alter table public.proveedor_servicio_pagos
  add column if not exists estado text not null default 'pagado',
  add column if not exists vencimiento date,
  add column if not exists pagado_at date;

alter table public.proveedor_servicio_pagos
  drop constraint if exists proveedor_servicio_pagos_estado_check;
alter table public.proveedor_servicio_pagos
  add constraint proveedor_servicio_pagos_estado_check
  check (estado in ('pagado', 'pendiente'));

-- Un pendiente no puede tener un egreso de caja colgado (invariante del punto
-- anterior; barata de chequear y evita que un bug la rompa en silencio).
alter table public.proveedor_servicio_pagos
  drop constraint if exists proveedor_servicio_pagos_pendiente_sin_caja;
alter table public.proveedor_servicio_pagos
  add constraint proveedor_servicio_pagos_pendiente_sin_caja
  check (estado <> 'pendiente' or caja_movimiento_id is null);

create index if not exists idx_prov_serv_pagos_pendientes
  on public.proveedor_servicio_pagos (tenant_id, vencimiento)
  where estado = 'pendiente';

-- La lista de proveedores muestra "saldo deudor" para todos, pero los de
-- servicio no tienen compras: siempre mostraban $0. Exponemos lo pendiente
-- como columna aparte (no la sumamos a `saldo` para no romper la aritmética
-- total_compras - total_pagado que usa el detalle de insumos).
create or replace view public.saldos_proveedores as
select
  p.id,
  p.tenant_id,
  p.name,
  p.payment_terms_days,
  p.active,
  p.tipo,
  coalesce(c.total_compras, 0::numeric) as total_compras,
  coalesce(pg.total_pagado, 0::numeric) as total_pagado,
  greatest(coalesce(c.total_compras, 0::numeric) - coalesce(pg.total_pagado, 0::numeric), 0::numeric) as saldo,
  coalesce(aging.d0_30, 0::numeric) as d0_30,
  coalesce(aging.d31_60, 0::numeric) as d31_60,
  coalesce(aging.d61_90, 0::numeric) as d61_90,
  coalesce(aging.d90plus, 0::numeric) as d90plus,
  p.contact_name,
  p.contact_phone,
  p.contact_email,
  p.notes,
  p.discrimina_iva,
  p.iva_rate,
  p.descuento_pct,
  p.payment_rule,
  p.metodo_pago_default,
  p.ai_extraction_notes,
  coalesce(sv.pendiente_servicios, 0::numeric) as pendiente_servicios
from proveedores p
  left join (
    select compras.proveedor_id, sum(compras.total) as total_compras
    from compras
    group by compras.proveedor_id
  ) c on c.proveedor_id = p.id
  left join (
    select pagos_proveedor.proveedor_id, sum(pagos_proveedor.monto) as total_pagado
    from pagos_proveedor
    group by pagos_proveedor.proveedor_id
  ) pg on pg.proveedor_id = p.id
  left join (
    select compras.proveedor_id,
      sum(case when compras.due_date is null or (current_date - compras.due_date) <= 30 then compras.total else 0::numeric end) as d0_30,
      sum(case when compras.due_date is not null and (current_date - compras.due_date) between 31 and 60 then compras.total else 0::numeric end) as d31_60,
      sum(case when compras.due_date is not null and (current_date - compras.due_date) between 61 and 90 then compras.total else 0::numeric end) as d61_90,
      sum(case when compras.due_date is not null and (current_date - compras.due_date) > 90 then compras.total else 0::numeric end) as d90plus
    from compras
    where compras.status <> 'pagada'::compra_status
    group by compras.proveedor_id
  ) aging on aging.proveedor_id = p.id
  left join (
    select proveedor_servicio_pagos.proveedor_id, sum(proveedor_servicio_pagos.monto) as pendiente_servicios
    from proveedor_servicio_pagos
    where proveedor_servicio_pagos.estado = 'pendiente'
    group by proveedor_servicio_pagos.proveedor_id
  ) sv on sv.proveedor_id = p.id;
