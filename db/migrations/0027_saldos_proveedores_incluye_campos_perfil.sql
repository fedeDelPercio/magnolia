-- La vista saldos_proveedores no exponia los campos del perfil (contact_*,
-- notes, discrimina_iva, payment_rule). El dialog de edicion los lee desde el
-- objeto cargado en la lista y caian a su fallback (`false`/`''`), haciendo
-- creer que el cambio no quedaba guardado cuando en realidad si se persistia.
create or replace view public.saldos_proveedores as
select
  p.id,
  p.tenant_id,
  p.name,
  p.payment_terms_days,
  p.active,
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
  p.payment_rule
from public.proveedores p
  left join (
    select compras.proveedor_id, sum(compras.total) as total_compras
    from public.compras
    group by compras.proveedor_id
  ) c on c.proveedor_id = p.id
  left join (
    select pagos_proveedor.proveedor_id, sum(pagos_proveedor.monto) as total_pagado
    from public.pagos_proveedor
    group by pagos_proveedor.proveedor_id
  ) pg on pg.proveedor_id = p.id
  left join (
    select compras.proveedor_id,
      sum(case when compras.due_date is null or (current_date - compras.due_date) <= 30 then compras.total else 0::numeric end) as d0_30,
      sum(case when compras.due_date is not null and (current_date - compras.due_date) >= 31 and (current_date - compras.due_date) <= 60 then compras.total else 0::numeric end) as d31_60,
      sum(case when compras.due_date is not null and (current_date - compras.due_date) >= 61 and (current_date - compras.due_date) <= 90 then compras.total else 0::numeric end) as d61_90,
      sum(case when compras.due_date is not null and (current_date - compras.due_date) > 90 then compras.total else 0::numeric end) as d90plus
    from public.compras
    where compras.status <> 'pagada'::compra_status
    group by compras.proveedor_id
  ) aging on aging.proveedor_id = p.id;
