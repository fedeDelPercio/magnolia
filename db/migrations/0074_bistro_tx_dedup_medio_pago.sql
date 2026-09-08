-- Dedup de transacciones Bistro: sumar el medio de pago a la clave.
--
-- Un ticket cobrado con dos medios ("Comanda (Pago parcial)" / "Venta
-- (Multipago)") viene como DOS cabeceras con el mismo ticketNumber. La clave
-- anterior no miraba el medio de pago, asi que si las dos patas comparten la
-- hora (pasa: ticket 132743 del 05/09, ONLINE 12.000 + EFECTIVO 30.000, ambas
-- 13:34:49) la segunda pisaba a la primera y esa plata no entraba al sistema.
--
-- NULLS NOT DISTINCT para que una fila sin medio de pago siga deduplicando
-- (con el default de Postgres dos NULL no colisionan y el upsert insertaria un
-- duplicado nuevo en cada corrida).

drop index if exists public.uq_bistro_tx_dedup;

create unique index uq_bistro_tx_dedup
  on public.bistro_transacciones
  (tenant_id, shop_code, fecha_local, ticket_number, fecha_hora, transaction_type, payment_method)
  nulls not distinct;
