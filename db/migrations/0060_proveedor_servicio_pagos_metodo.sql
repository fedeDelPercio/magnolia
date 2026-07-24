-- Los pagos a proveedores de SERVICIOS no registraban el método de pago
-- (efectivo/transferencia/cheque/otro), así que un pago por transferencia no
-- se descontaba de Medios Digitales — a diferencia de los pagos a proveedores
-- de insumos (pagos_proveedor.metodo). Agregamos la columna para igualar la
-- lógica.
--
-- Default 'otro' para las filas existentes: como no sabemos cómo se pagaron los
-- servicios históricos, las dejamos como NO digitales (preserva el saldo digital
-- actual). Los pagos nuevos capturan el método real desde el diálogo.

alter table public.proveedor_servicio_pagos
  add column metodo public.pago_metodo not null default 'otro';
