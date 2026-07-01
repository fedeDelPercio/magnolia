-- Modelo de IVA y descuento por proveedor / compra / item.
--
-- Reemplaza el flag booleano discrimina_iva (21% o nada) por una tasa
-- multivaluada 0/10.5/21 en proveedores.iva_rate. Sumamos descuento_pct por
-- proveedor (default para sus compras) y overrides en compras/compra_items.
--
-- Regla de calculo (por linea):
--   linea_neto        = qty * unit_price
--   linea_descontada  = linea_neto * (1 - descuento_pct/100)
--   linea_iva         = linea_descontada * (iva_rate/100)
--   linea_total       = linea_descontada + linea_iva
--
-- IVA por linea: si compra_items.iva_rate is null usa compra.iva_rate (global).
-- descuento_pct: solo a nivel proveedor/compra (no por linea).
-- discrimina_iva se mantiene para back-compat pero se sincroniza con iva_rate>0.

alter table public.proveedores
  add column if not exists iva_rate numeric(5,2) not null default 0,
  add column if not exists descuento_pct numeric(5,2) not null default 0;

update public.proveedores
  set iva_rate = 21
  where discrimina_iva = true and iva_rate = 0;

alter table public.proveedores
  drop constraint if exists proveedores_iva_rate_check,
  add constraint proveedores_iva_rate_check check (iva_rate in (0, 10.5, 21));

alter table public.proveedores
  drop constraint if exists proveedores_descuento_pct_check,
  add constraint proveedores_descuento_pct_check check (descuento_pct >= 0 and descuento_pct <= 100);

alter table public.compras
  add column if not exists iva_rate numeric(5,2) not null default 0,
  add column if not exists descuento_pct numeric(5,2) not null default 0;

alter table public.compras
  drop constraint if exists compras_iva_rate_check,
  add constraint compras_iva_rate_check check (iva_rate in (0, 10.5, 21));

alter table public.compras
  drop constraint if exists compras_descuento_pct_check,
  add constraint compras_descuento_pct_check check (descuento_pct >= 0 and descuento_pct <= 100);

alter table public.compra_items
  add column if not exists iva_rate numeric(5,2);

alter table public.compra_items
  drop constraint if exists compra_items_iva_rate_check,
  add constraint compra_items_iva_rate_check check (iva_rate is null or iva_rate in (0, 10.5, 21));
