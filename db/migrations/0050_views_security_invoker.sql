-- Vistas cross-tenant leak: por default los VIEWs en Postgres corren con los
-- permisos del OWNER (no del que hace la query), asi que el RLS de la tabla
-- subyacente NO se propaga. Resultado: la vista product_costs devolvia
-- productos de otros tenants — el usuario veia "Apple Crumble" dos veces en
-- la UI cuando la tabla productos tenia una fila en Magnolia Demo y otra en
-- Bistró Pampa. Idem para saldos_proveedores, insumo_stock y cierres_caja_active.
--
-- Fix: security_invoker=true (PG15+) hace que la vista use los permisos del
-- que ejecuta la query, con lo cual el RLS de la tabla subyacente se aplica
-- normalmente. No cambia el shape ni las columnas de la vista.

alter view public.product_costs set (security_invoker = true);
alter view public.saldos_proveedores set (security_invoker = true);
alter view public.insumo_stock set (security_invoker = true);
alter view public.cierres_caja_active set (security_invoker = true);
