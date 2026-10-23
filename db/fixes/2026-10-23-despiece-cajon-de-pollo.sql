-- Cajón de pollo: el despiece multiplicaba las piezas por 6 (Magnolia Demo) — 2026-10-23
--
-- El insumo "Cajón de pollo" se mide por pollo: la compra "1 Cajón" se guarda
-- como 6 u (6 pollos). Pero el despiece estaba cargado por cajón (12 pata
-- muslo + 12 pechugas por cada unidad), así que cada cajón generaba 72 + 72
-- piezas a 1/144 del precio, en vez de 12 + 12 a 1/24. Pollo al horno costaba
-- ~$500 de pata muslo en vez de ~$3.000 (la suelta se compra a $2.800–4.500).
--
-- 1) Despiece por pollo: 2 pata muslo + 2 pechugas.
-- 2) Las 31 compras de cajón (02/07 a 23/10): misma plata, piezas / 6 y
--    precio unitario x 6.
-- 3) Historial de precios de esas compras y precio actual de las piezas x 6;
--    precio del cajón (por pollo) = 4 piezas.

begin;

do $$
declare
  cajon constant uuid := '22f6e2f3-c5de-42cd-8289-689a4c649a9b';
  pata constant uuid := 'ca571bbb-f8dc-4651-bba0-0ac711bac4b9';
  pechuga constant uuid := 'a0342944-8b68-4e11-a535-46c07980d08f';
  compras_cajon uuid[];
  n integer;
  total_antes numeric;
  total_despues numeric;
begin
  -- 1) Despiece
  update public.insumo_despiece set qty_por_unidad = 2
   where parent_id = cajon and hijo_id in (pata, pechuga) and qty_por_unidad = 12;
  get diagnostics n = row_count;
  if n <> 2 then raise exception '1: se esperaban 2 filas de despiece en 12, hubo %', n; end if;

  -- 2) Compras: las líneas del despiece son la pata y la pechuga de la misma
  --    compra con igual cantidad y precio.
  select array_agg(distinct a.compra_id) into compras_cajon
    from public.compra_items a
   where a.insumo_id in (pata, pechuga)
     and exists (select 1 from public.compra_items b
                  where b.compra_id = a.compra_id and b.insumo_id in (pata, pechuga)
                    and b.insumo_id <> a.insumo_id and b.qty = a.qty and b.unit_price = a.unit_price);
  if array_length(compras_cajon, 1) <> 31 then
    raise exception '2: se esperaban 31 compras de cajón, hay %', array_length(compras_cajon, 1);
  end if;

  select sum(qty * unit_price) into total_antes
    from public.compra_items where compra_id = any(compras_cajon) and insumo_id in (pata, pechuga);
  update public.compra_items set qty = qty / 6, unit_price = unit_price * 6
   where compra_id = any(compras_cajon) and insumo_id in (pata, pechuga) and qty % 72 = 0;
  get diagnostics n = row_count;
  if n <> 62 then raise exception '2: se esperaban 62 líneas, hubo %', n; end if;
  select sum(qty * unit_price) into total_despues
    from public.compra_items where compra_id = any(compras_cajon) and insumo_id in (pata, pechuga);
  if abs(total_despues - total_antes) > 0.5 then
    raise exception '2: cambió la plata de las compras (% → %)', total_antes, total_despues;
  end if;

  -- 3) Precios
  update public.insumo_price_history set price = round(price * 6, 2)
   where insumo_id in (pata, pechuga) and source = 'compra' and source_id = any(compras_cajon);
  get diagnostics n = row_count;
  if n < 60 then raise exception '3: se esperaban ~66 precios del historial, hubo %', n; end if;

  update public.insumos set current_price = round(current_price * 6, 2), updated_at = now()
   where id in (pata, pechuga) and current_price < 1000;
  get diagnostics n = row_count;
  if n <> 2 then raise exception '3: se esperaban 2 piezas con precio a corregir, hubo %', n; end if;

  update public.insumos set current_price = (select current_price * 4 from public.insumos where id = pata), updated_at = now()
   where id = cajon;
end $$;

commit;
