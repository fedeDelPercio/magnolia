-- Bug original: el unique (tenant, shop, ticket_number, fecha_local) hacia que
-- todos los movimientos administrativos (APERTURA, CIERRE, RETIRO, DEPOSITO)
-- colapsaran en una sola row por dia porque la API les asigna ticketNumber=0
-- a todos. Resultado: solo persistia uno por dia (el ultimo procesado).
--
-- Fix: agregar fecha_hora y transaction_type a la dedup key. Para ventas
-- normales (ticket > 0) es redundante pero inocuo; para movimientos con
-- ticket=0 los diferencia por instante + tipo, que es como Bistro los unifica.

drop index if exists public.uq_bistro_tx_tenant_shop_ticket_date;

create unique index uq_bistro_tx_dedup
  on public.bistro_transacciones (tenant_id, shop_code, fecha_local, ticket_number, fecha_hora, transaction_type);
