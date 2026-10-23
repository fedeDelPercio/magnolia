-- Datos para revisar: controles de integridad que se muestran en Alertas.
--
-- Cada fila es un problema a corregir en el Catálogo. Nacen de errores reales:
-- - receta_unidad: la receta usa el insumo en una unidad que no se puede
--   convertir a la del insumo (30 g de verdeo se descontaban como 30 atados).
-- - precio_raro: el precio actual del insumo es 3 veces o más distinto al
--   habitual de sus compras de los últimos 120 días (azúcar a $66.666 el kg
--   por cargar 0,01 pack).
-- - vendido_sin_receta: se vendió en los últimos 30 días y no tiene receta con
--   ingredientes (ni una variante del mismo concepto que la tenga): no tiene
--   costo ni descuenta stock (Mini Balcarce).
-- - costo_mayor_precio: el costo calculado supera el precio de venta; casi
--   siempre es un ingrediente con la unidad o el precio mal.
-- - stock_negativo: insumo con control de stock por debajo de cero.

create or replace view public.datos_para_revisar
with (security_invoker = true) as
with
lineas_mal as (
  select i.tenant_id, i.id insumo_id, i.name, i.unit::text insumo_unit, ri.unit::text receta_unit, r.name receta
    from public.receta_ingredientes ri
    join public.insumos i on i.id = ri.insumo_id
    join public.recetas r on r.id = ri.receta_id
   where not (
     ri.unit::text = i.unit::text
     or (ri.unit::text in ('kg', 'g') and i.unit::text in ('kg', 'g'))
     or (ri.unit::text in ('l', 'ml') and i.unit::text in ('l', 'ml'))
     or (ri.unit::text in ('u', 'docena') and i.unit::text in ('u', 'docena'))
   )
),
precios as (
  select h.insumo_id, percentile_cont(0.5) within group (order by h.price)::numeric mediana, count(*) n
    from public.insumo_price_history h
   where h.source = 'compra' and h.valid_from >= now() - interval '120 days' and h.price > 0
   group by h.insumo_id
),
vendidos as (
  select m.producto_id, sum(m.ventas) ventas
    from public.movimientos_diarios m
    join public.dias_operativos d on d.id = m.dia_id
   where d.fecha >= current_date - 30 and m.ventas > 0
   group by m.producto_id
)
select tenant_id, 'receta_unidad'::text tipo, name nombre,
       'Las recetas lo usan en ' || receta_unit || ' y el insumo está en ' || insumo_unit || ': '
         || string_agg(receta, ', ' order by receta) detalle,
       count(*)::numeric valor
  from lineas_mal
 group by tenant_id, insumo_id, name, receta_unit, insumo_unit
union all
select i.tenant_id, 'precio_raro', i.name,
       'Precio actual $' || to_char(i.current_price, 'FM999G999G990D00') || ' por ' || i.unit::text
         || '; sus compras rondan $' || to_char(p.mediana, 'FM999G999G990D00'),
       round(greatest(i.current_price / p.mediana, p.mediana / i.current_price), 1)
  from public.insumos i
  join precios p on p.insumo_id = i.id
 where i.active and i.current_price > 0 and p.n >= 3
   and (i.current_price >= 3 * p.mediana or i.current_price * 3 <= p.mediana)
union all
select p.tenant_id, 'vendido_sin_receta', p.name,
       v.ventas::int || ' vendidos en 30 días sin receta: no tiene costo ni descuenta stock',
       v.ventas
  from vendidos v
  join public.productos p on p.id = v.producto_id
 where p.name !~* '^(gen[eé]rico|adicional|descuento)'
   and not exists (select 1 from public.receta_ingredientes ri where ri.receta_id = p.receta_id)
   and not exists (select 1 from public.productos p2
                    join public.receta_ingredientes ri on ri.receta_id = p2.receta_id
                   where p.concepto_id is not null and p2.concepto_id = p.concepto_id and p2.id <> p.id and p2.active)
union all
select c.tenant_id, 'costo_mayor_precio', c.name,
       'Costo $' || to_char(c.total_cost, 'FM999G999G990') || ' y se vende a $' || to_char(c.sale_price, 'FM999G999G990'),
       round(c.total_cost / c.sale_price, 1)
  from public.product_costs c
 where c.active and c.sale_price > 0 and c.total_cost > c.sale_price
union all
select s.tenant_id, 'stock_negativo', i.name,
       'Stock ' || to_char(s.stock_actual, 'FM999G999G990D0') || ' ' || s.unit
         || ': se usó más de lo que se compró desde el último conteo',
       round(s.stock_actual, 1)
  from public.insumo_stock s
  join public.insumos i on i.id = s.insumo_id
 where i.active and s.stock_actual < 0;

comment on view public.datos_para_revisar is
  'Controles de integridad (unidades de receta, precios raros, vendidos sin receta, costo > precio, stock negativo) que se muestran en Alertas.';
