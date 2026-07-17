-- Método de pago por defecto por proveedor. Sirve para precargar el select
-- del PagoDialog y que la user (Caro) no tenga que elegir cada vez el mismo
-- metodo — puede editarlo por pago individual si esa vez pagó distinto.
--
-- Valores validos: mismos que pagos_proveedor.metodo (efectivo | transferencia
-- | cheque | otro). NULL = sin default, el dialog cae al hardcoded actual.

alter table public.proveedores
  add column if not exists metodo_pago_default text null;

alter table public.proveedores
  drop constraint if exists proveedores_metodo_pago_default_check,
  add constraint proveedores_metodo_pago_default_check
    check (metodo_pago_default is null
        or metodo_pago_default in ('efectivo','transferencia','cheque','otro'));

-- Refrescar la vista saldos_proveedores para exponer el nuevo campo (la UI
-- lee de esta vista, no de la tabla). drop+create porque CREATE OR REPLACE
-- no admite insertar columnas en el medio.
drop view if exists public.saldos_proveedores;

create view public.saldos_proveedores
with (security_invoker = true) as
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
  p.metodo_pago_default
from proveedores p
left join (
  select proveedor_id, sum(total) as total_compras
  from compras group by proveedor_id
) c on c.proveedor_id = p.id
left join (
  select proveedor_id, sum(monto) as total_pagado
  from pagos_proveedor group by proveedor_id
) pg on pg.proveedor_id = p.id
left join (
  select
    proveedor_id,
    sum(case when due_date is null or (current_date - due_date) <= 30 then total else 0 end) as d0_30,
    sum(case when due_date is not null and (current_date - due_date) between 31 and 60 then total else 0 end) as d31_60,
    sum(case when due_date is not null and (current_date - due_date) between 61 and 90 then total else 0 end) as d61_90,
    sum(case when due_date is not null and (current_date - due_date) > 90 then total else 0 end) as d90plus
  from compras
  where status <> 'pagada'::compra_status
  group by proveedor_id
) aging on aging.proveedor_id = p.id;
