-- Stock de insumos en cero para empezar a controlar (Magnolia Demo) — 2026-10-14
--
-- Pedido de Caro: el stock de insumos no era confiable; arranca a controlarlo
-- desde el 15/10. Se carga un ajuste a 0 (como un conteo) en cada insumo con
-- control de stock: ingredientes y descartables. No se borra nada: el
-- historial de compras, consumos y ajustes queda igual.
--
-- - Los 12 insumos que Caro contó hoy (14/10, 13:51 a 14:11) quedan con su conteo.
-- - El ajuste lleva fecha 15/10 00:00 UTC (14/10 21:00 en Argentina): la vista
--   insumo_stock descuenta el consumo por día en UTC, así que con esa fecha las
--   ventas y la producción del 14/10 no descuentan desde cero. Las compras
--   cargadas antes de esa hora tampoco suman.
--
-- Para deshacerlo: borrar los ajustes con esa fecha y la nota de abajo; vuelve
-- todo a como estaba.

begin;

do $$
declare
  demo constant uuid := '2eaa43e4-d06d-4568-bcb3-1720587eddac';
  corte constant timestamptz := '2026-10-15 00:00:00+00';
  hoy constant timestamptz := '2026-10-14 03:00:00+00';  -- 14/10 00:00 en Argentina
  nota constant text := 'Stock en cero para empezar a controlar desde el 15/10';
  contados integer;
  esperados integer;
  n integer;
begin
  select count(distinct a.insumo_id) into contados
    from public.insumo_stock_ajustes a
   where a.tenant_id = demo and a.created_at >= hoy and a.created_at < corte;
  if contados <> 12 then raise exception 'Se esperaban los 12 conteos de hoy, hay %', contados; end if;

  select count(*) into esperados
    from public.insumos i
   where i.tenant_id = demo and i.track_stock
     and not exists (select 1 from public.insumo_stock_ajustes a where a.insumo_id = i.id and a.created_at >= hoy);
  if esperados <> 174 then raise exception 'Se esperaban 174 insumos para poner en cero, hay %', esperados; end if;

  insert into public.insumo_stock_ajustes (insumo_id, tenant_id, stock_teorico, stock_real, notas, created_at, created_by)
  select i.id, demo, coalesce(s.stock_actual, 0), 0, nota, corte, null
    from public.insumos i
    left join public.insumo_stock s on s.insumo_id = i.id
   where i.tenant_id = demo and i.track_stock
     and not exists (select 1 from public.insumo_stock_ajustes a where a.insumo_id = i.id and a.created_at >= hoy);
  get diagnostics n = row_count;
  if n <> esperados then raise exception 'Se cargaron % ajustes, se esperaban %', n, esperados; end if;

  -- Todos los que se pusieron en cero tienen que dar 0 en la vista.
  select count(*) into n
    from public.insumo_stock s
    join public.insumo_stock_ajustes a on a.insumo_id = s.insumo_id and a.created_at = corte and a.notas = nota
   where s.tenant_id = demo and s.stock_actual <> 0;
  if n <> 0 then raise exception 'Quedaron % insumos con stock distinto de cero', n; end if;
end $$;

commit;
