-- 0026_seed_magnolia_real.sql
-- Wipe del catálogo demo (productos/insumos/recetas + data sintética asociada)
-- + Carga del catálogo REAL desde Excel "Análisis de MAGNOLIA" + "Recetas (1)"
--
-- Lo que NO se toca: cierres_caja, bistro_*, empleados, proveedores (los reales),
-- alertas, configs. Solo se borran: productos, recetas, insumos demo + sus
-- referencias en compras/movimientos sintéticos.

begin;

do $$
declare
  v_tenant uuid := '2eaa43e4-d06d-4568-bcb3-1720587eddac';
begin
  -- Wipe data sintética y catálogo demo
  delete from public.movimientos_diarios where dia_id in (select id from public.dias_operativos where tenant_id = v_tenant);
  delete from public.producto_descartables where producto_id in (select id from public.productos where tenant_id = v_tenant);
  delete from public.producto_aliases where tenant_id = v_tenant;
  delete from public.compra_items where compra_id in (select id from public.compras where tenant_id = v_tenant);
  delete from public.compras where tenant_id = v_tenant;
  delete from public.productos where tenant_id = v_tenant;
  delete from public.receta_ingredientes where receta_id in (select id from public.recetas where tenant_id = v_tenant);
  delete from public.recetas where tenant_id = v_tenant;
  delete from public.insumo_price_history where insumo_id in (select id from public.insumos where tenant_id = v_tenant);
  delete from public.insumo_stock_ajustes where insumo_id in (select id from public.insumos where tenant_id = v_tenant);
  delete from public.insumos where tenant_id = v_tenant;
end $$;

-- ============================================================
-- INSUMOS
-- ============================================================
insert into public.insumos (tenant_id, name, unit, current_price, kind, perishable, active)
values
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Mila de Nalga', 'kg', 6875.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Carne picada', 'kg', 13500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'picada de pollo', 'kg', 9200.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Pechugas', 'kg', 3500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cajón de pollo', 'u', 3035.714285714286, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bondiola', 'kg', 7800.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Matambre', 'kg', 19500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Pechito de Cerdo', 'kg', 8000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Rastbeef', 'kg', 9775.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Chorizo', 'kg', 3500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'mila de cerdo', 'kg', 13900.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Filet', 'kg', 8990.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Hielo', 'kg', 1020.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Lechuga', 'kg', 2000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cherry', 'kg', 12000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Perita', 'kg', 400.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Repollo', 'kg', 2000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Berenjena', 'kg', 1500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Zapallitos', 'kg', 2000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Limón', 'kg', 2000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Apio', 'kg', 2000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Verdeo', 'kg', 600.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Naranja .5', 'kg', 13000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Morrón', 'kg', 5000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Acelga', 'u', 8000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Ajo', 'u', 1000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Zanahoria x 10kg', 'kg', 1600.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'papa x 16 Kg', 'kg', 875.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Frutilla', 'kg', 600.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Uvas', 'u', 0.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Banana', 'kg', 500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Manzana', 'kg', 2500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Anco x 15 Kg', 'kg', 1200.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cebolla x 18 Kg', 'kg', 777.7777777777778, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Brócoli', 'kg', 1000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Paltas', 'u', 1500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Rúcula', 'u', 800.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Albahaca', 'u', 1500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Batata', 'kg', 2000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Boniato', 'u', 2500.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cajón de Huevos', 'u', 200.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Servilletas', 'u', 8.44, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Rollos Eco', 'u', 7953.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Folex', 'u', 4235.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Vasos 240cc c/tapa', 'u', 109.48, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Vaso 360cc', 'u', 143.83, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bandeja N1', 'u', 17.87, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bandeja N 2', 'u', 21.53, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bolsa craft 4A', 'u', 16.97, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bolsa craft 5A', 'u', 19.62, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Rotlem', 'u', 125.49, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Camiseta 40 x 50', 'u', 17.14, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Consorcio 80x110', 'u', 1850.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Guantes látex', 'u', 5038.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bolsas de propileno', 'u', 1273.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Film', 'u', 7261.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Aluminio', 'u', 8200.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Pote 55 c/tapa', 'u', 56.55, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'vaso de 500cc', 'u', 12316.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Comaderas', 'u', 1362.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bandejas 102', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bandejas 103', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bandeja Ovalada', 'u', 7125.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cuchillo Cristal', 'u', 19.82, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Tenedor Cristal', 'u', 19.82, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cofias', 'u', 3855.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Guantes poliprop', 'u', 765.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Flaneras N 10', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Escarbadientes', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Platos térmicos', 'u', 862.07, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bobina Kraft', 'u', 17397.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cajas pizza x 200', 'u', 350.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cajas media docena x 300', 'u', 340.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Medialunas de grasa', 'u', 0.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Medialunas de Manteca', 'u', 421.73333333333335, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Baguettes', 'u', 485.1, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Muffins', 'u', 1730.2916666666667, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Ciabatta', 'u', 1363.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Arabe Integral', 'u', 440.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Arabe común', 'u', 430.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Chipa', 'u', 1666.6666666666667, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Paleta', 'g', 5518.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Oliva Blister', 'u', 243.935, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Aceto Blister', 'u', 81.31, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Sal Blister', 'u', 54.45, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Mayonesa Blister', 'u', 109.63775510204081, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Ketchup Blister', 'u', 96.3061224489796, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Savora Blister', 'u', 92.60204081632654, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Vinagre Blister', 'u', 74.05, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Limón Blister', 'u', 69.695, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Maíz Blister', 'u', 112.60204081632654, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Aceite de 10L', 'u', 2904.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Oliva 5L', 'u', 4095.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Aceto 5L', 'u', 3660.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Vinagre 5L', 'u', 8334.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Jamon cocido', 'g', 900.2, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Tybo', 'u', 972.8, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Aceitunas negras', 'u', 0.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Mix de semillas', 'u', 726.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Rebozador', 'u', 3310.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Curry', 'u', 10600.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Provenzal', 'u', 1263.2, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Orégano', 'u', 8494.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Aji Molido', 'u', 9728.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Pimentón dulce', 'u', 8277.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Puré de tomate x 12', 'u', 12720.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Tomates secos', 'u', 2613.6, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Barbacoa 1kg', 'u', 8131.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Mostaza', 'u', 3388.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Azúcar Sobre', 'u', 26.31875, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Arroz', 'u', 9583.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Sal fina x 12', 'u', 20908.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Sal Gruesa', 'u', 0.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Azúcar', 'u', 10146.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Nuez moscada', 'u', 0.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Leche', 'u', 1187.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Caldo de verdura', 'u', 31944.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cheddar', 'u', 6734.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Edulcorante', 'u', 23.232, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Comino', 'u', 0.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Caldito', 'u', 31944.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Yamani', 'u', 0.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Miel', 'u', 4719.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Lentejas', 'u', 0.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Muzzarellas kg', 'u', 768.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Atún lomitos', 'u', 3120.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Atún desmenuzado', 'u', 2600.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Sardo', 'u', 768.3, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Crema Litros', 'u', 772.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Ketchp', 'u', 380.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Panceta', 'u', 1476.5, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Jamón crudo', 'u', 1667.5, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Mayonesa', 'u', 425.3, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Manteca', 'u', 1252.9, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Queso crema', 'u', 1000.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Coca Común', 'u', 1063.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Coca Zero', 'u', 1063.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Coca Light', 'u', 1063.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Sprite', 'u', 1063.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Fanta', 'u', 1063.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Agua con Gas', 'u', 650.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Agua Sin Gas', 'u', 700.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Acquarius', 'u', 811.8333333333334, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Tónica', 'u', 1103.8333333333333, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cerveza', 'u', 1931.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Bidones', 'u', 325.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Café kg', 'u', 523.93, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Lavandina', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Detergente', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Desengrasante', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cif', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Lavandina en gel', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Alcohol', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Desodorante de pisos', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Esponjas Amarillas', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Esponjas acero', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Rejillas', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Trapo de piso', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Mopa', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'guantes', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Escobillon', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cera', 'u', 0.0, 'descartable', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Adobo', 'g', 12.5, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Tapa de empanada', 'u', 200, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Jengibre', 'g', 8.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Menta', 'g', 15.0, 'ingrediente', false, true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Frutas mix', 'g', 6.0, 'ingrediente', false, true);

-- ============================================================
-- RECETAS (sub-recetas + productos finales)
-- ============================================================
insert into public.recetas (tenant_id, name, yield_qty, yield_unit, active)
values
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Empanadas de Carne', 140, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Empanadas de Pollo', 94, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Empanadas de J y Q', 41, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Empanadas de Bondiola', 60, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Rolls de Verdura', 80, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Canastitas de Calabaza', 20, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Empanadas de C y Q', 1, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Canastitas Caprese', 1, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Mezcla Base de Quiches', 34, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Quiche Jamón y Queso', 1, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Quiche Pollo, Verdeo y Panceta', 1, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Salsa Fileto', 20, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Salsa Bolognesa', 20, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Milanesa', 1, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Milanesa Napo', 1, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Relleno de Bondiola', 12, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Cebolla rehogada', 30, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Pastas', 1, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Pechuga Curry y Fez', 1, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Puré (guarnición)', 10, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Fritas (guarnición)', 10, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Tostado Común', 1, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Tostado Magnolia', 1, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Licuados', 1, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Limonada', 1, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Promo Clásica', 1, 'u', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Flanes', 1, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Mix de ensalada', 20, 'porcion', true),
  ('2eaa43e4-d06d-4568-bcb3-1720587eddac', 'Aderezos Extra', 20, 'porcion', true);

-- ============================================================
-- RECETA_INGREDIENTES (líneas de cada receta)
-- ============================================================
-- Usamos CTEs para resolver insumo_id y sub_receta_id por nombre

-- Insumos en recetas
insert into public.receta_ingredientes (receta_id, kind, insumo_id, qty, unit)
select r.id, 'insumo'::ingrediente_kind, i.id, v.qty, v.unit::unit_kind
from (values
  ('Empanadas de Carne', 'Carne picada', 8.0::numeric, 'kg'),
  ('Empanadas de Carne', 'Cebolla x 18 Kg', 16.0::numeric, 'kg'),
  ('Empanadas de Carne', 'Verdeo', 100.0::numeric, 'g'),
  ('Empanadas de Carne', 'Morrón', 2.0::numeric, 'u'),
  ('Empanadas de Carne', 'Adobo', 40.0::numeric, 'g'),
  ('Empanadas de Carne', 'Pimentón dulce', 40.0::numeric, 'g'),
  ('Empanadas de Carne', 'Provenzal', 40.0::numeric, 'g'),
  ('Empanadas de Carne', 'Sal fina x 12', 30.0::numeric, 'g'),
  ('Empanadas de Carne', 'Tapa de empanada', 1.0::numeric, 'u'),
  ('Empanadas de Pollo', 'picada de pollo', 3.0::numeric, 'kg'),
  ('Empanadas de Pollo', 'Cebolla x 18 Kg', 6.0::numeric, 'kg'),
  ('Empanadas de Pollo', 'Verdeo', 50.0::numeric, 'g'),
  ('Empanadas de Pollo', 'Adobo', 20.0::numeric, 'g'),
  ('Empanadas de Pollo', 'Pimentón dulce', 20.0::numeric, 'g'),
  ('Empanadas de Pollo', 'Provenzal', 20.0::numeric, 'g'),
  ('Empanadas de Pollo', 'Sal fina x 12', 30.0::numeric, 'g'),
  ('Empanadas de Pollo', 'Tapa de empanada', 1.0::numeric, 'u'),
  ('Empanadas de J y Q', 'Muzzarellas kg', 2.0::numeric, 'kg'),
  ('Empanadas de J y Q', 'Paleta', 1.0::numeric, 'kg'),
  ('Empanadas de J y Q', 'Tapa de empanada', 1.0::numeric, 'u'),
  ('Empanadas de Bondiola', 'Morrón', 1.0::numeric, 'u'),
  ('Empanadas de Bondiola', 'Tapa de empanada', 1.0::numeric, 'u'),
  ('Rolls de Verdura', 'Acelga', 1.0::numeric, 'u'),
  ('Rolls de Verdura', 'Zanahoria x 10kg', 200.0::numeric, 'g'),
  ('Rolls de Verdura', 'Cebolla x 18 Kg', 1.5::numeric, 'kg'),
  ('Rolls de Verdura', 'Tapa de empanada', 1.0::numeric, 'u'),
  ('Canastitas de Calabaza', 'Anco x 15 Kg', 800.0::numeric, 'g'),
  ('Canastitas de Calabaza', 'Muzzarellas kg', 700.0::numeric, 'g'),
  ('Canastitas de Calabaza', 'Cebolla x 18 Kg', 400.0::numeric, 'g'),
  ('Canastitas de Calabaza', 'Nuez moscada', 20.0::numeric, 'g'),
  ('Canastitas de Calabaza', 'Sal fina x 12', 20.0::numeric, 'g'),
  ('Canastitas de Calabaza', 'Tapa de empanada', 1.0::numeric, 'u'),
  ('Empanadas de C y Q', 'Muzzarellas kg', 50.0::numeric, 'g'),
  ('Empanadas de C y Q', 'Cebolla x 18 Kg', 70.0::numeric, 'g'),
  ('Empanadas de C y Q', 'Tapa de empanada', 1.0::numeric, 'u'),
  ('Canastitas Caprese', 'Muzzarellas kg', 70.0::numeric, 'g'),
  ('Canastitas Caprese', 'Cherry', 3.0::numeric, 'u'),
  ('Canastitas Caprese', 'Albahaca', 1.0::numeric, 'u'),
  ('Canastitas Caprese', 'Tapa de empanada', 1.0::numeric, 'u'),
  ('Mezcla Base de Quiches', 'Cajón de Huevos', 80.0::numeric, 'u'),
  ('Mezcla Base de Quiches', 'Crema Litros', 5.0::numeric, 'l'),
  ('Quiche Jamón y Queso', 'Paleta', 3.0::numeric, 'u'),
  ('Quiche Jamón y Queso', 'Bandeja Ovalada', 1.0::numeric, 'u'),
  ('Quiche Jamón y Queso', 'Bolsa craft 4A', 1.0::numeric, 'u'),
  ('Quiche Jamón y Queso', 'Cuchillo Cristal', 1.0::numeric, 'u'),
  ('Quiche Pollo, Verdeo y Panceta', 'Pechugas', 60.0::numeric, 'g'),
  ('Quiche Pollo, Verdeo y Panceta', 'Verdeo', 45.0::numeric, 'g'),
  ('Quiche Pollo, Verdeo y Panceta', 'Panceta', 1.0::numeric, 'u'),
  ('Quiche Pollo, Verdeo y Panceta', 'Bandeja Ovalada', 1.0::numeric, 'u'),
  ('Quiche Pollo, Verdeo y Panceta', 'Bolsa craft 4A', 1.0::numeric, 'u'),
  ('Quiche Pollo, Verdeo y Panceta', 'Cuchillo Cristal', 1.0::numeric, 'u'),
  ('Salsa Fileto', 'Puré de tomate x 12', 4.0::numeric, 'u'),
  ('Salsa Fileto', 'Zanahoria x 10kg', 5.0::numeric, 'u'),
  ('Salsa Fileto', 'Cebolla x 18 Kg', 5.0::numeric, 'u'),
  ('Salsa Fileto', 'Adobo', 1.0::numeric, 'u'),
  ('Salsa Fileto', 'Provenzal', 1.0::numeric, 'u'),
  ('Salsa Fileto', 'Sal fina x 12', 1.0::numeric, 'u'),
  ('Salsa Bolognesa', 'Cebolla x 18 Kg', 10.0::numeric, 'u'),
  ('Salsa Bolognesa', 'Morrón', 1.0::numeric, 'u'),
  ('Salsa Bolognesa', 'Puré de tomate x 12', 4.0::numeric, 'u'),
  ('Salsa Bolognesa', 'Orégano', 1.0::numeric, 'u'),
  ('Salsa Bolognesa', 'Provenzal', 1.0::numeric, 'u'),
  ('Salsa Bolognesa', 'Sal fina x 12', 1.0::numeric, 'u'),
  ('Salsa Bolognesa', 'Carne picada', 3.0::numeric, 'kg'),
  ('Milanesa', 'Mila de Nalga', 1.0::numeric, 'u'),
  ('Milanesa Napo', 'Mila de Nalga', 1.0::numeric, 'u'),
  ('Milanesa Napo', 'Muzzarellas kg', 45.0::numeric, 'g'),
  ('Relleno de Bondiola', 'Bondiola', 3.0::numeric, 'kg'),
  ('Relleno de Bondiola', 'Miel', 250.0::numeric, 'g'),
  ('Relleno de Bondiola', 'Verdeo', 200.0::numeric, 'g'),
  ('Relleno de Bondiola', 'Repollo', 200.0::numeric, 'g'),
  ('Relleno de Bondiola', 'Zanahoria x 10kg', 350.0::numeric, 'g'),
  ('Relleno de Bondiola', 'Apio', 300.0::numeric, 'g'),
  ('Relleno de Bondiola', 'Mostaza', 1.0::numeric, 'kg'),
  ('Relleno de Bondiola', 'Ketchp', 1.0::numeric, 'kg'),
  ('Relleno de Bondiola', 'Barbacoa 1kg', 1.0::numeric, 'kg'),
  ('Cebolla rehogada', 'Cebolla x 18 Kg', 4.5::numeric, 'kg'),
  ('Cebolla rehogada', 'Sal fina x 12', 10.0::numeric, 'g'),
  ('Pechuga Curry y Fez', 'Pechugas', 11.0::numeric, 'u'),
  ('Pechuga Curry y Fez', 'Sal fina x 12', 10.0::numeric, 'g'),
  ('Puré (guarnición)', 'papa x 16 Kg', 1.0::numeric, 'u'),
  ('Puré (guarnición)', 'Manteca', 1.0::numeric, 'u'),
  ('Puré (guarnición)', 'Leche', 1.0::numeric, 'u'),
  ('Fritas (guarnición)', 'papa x 16 Kg', 1.0::numeric, 'u'),
  ('Tostado Común', 'Baguettes', 1.0::numeric, 'u'),
  ('Tostado Común', 'Muzzarellas kg', 64.0::numeric, 'g'),
  ('Tostado Común', 'Jamon cocido', 24.0::numeric, 'g'),
  ('Tostado Magnolia', 'Cajón de Huevos', 1.0::numeric, 'u'),
  ('Tostado Magnolia', 'Perita', 1.0::numeric, 'u'),
  ('Tostado Magnolia', 'Baguettes', 1.0::numeric, 'u'),
  ('Tostado Magnolia', 'Muzzarellas kg', 64.0::numeric, 'g'),
  ('Tostado Magnolia', 'Jamon cocido', 24.0::numeric, 'g'),
  ('Tostado Magnolia', 'Paltas', 1.0::numeric, 'u'),
  ('Licuados', 'Frutas mix', 200.0::numeric, 'g'),
  ('Licuados', 'Hielo', 200.0::numeric, 'g'),
  ('Licuados', 'Leche', 240.0::numeric, 'ml'),
  ('Limonada', 'Limón', 500.0::numeric, 'g'),
  ('Limonada', 'Hielo', 200.0::numeric, 'g'),
  ('Limonada', 'Jengibre', 15.0::numeric, 'g'),
  ('Limonada', 'Menta', 10.0::numeric, 'g'),
  ('Limonada', 'Azúcar', 20.0::numeric, 'g'),
  ('Limonada', 'Agua Sin Gas', 500.0::numeric, 'ml'),
  ('Promo Clásica', 'Medialunas de Manteca', 2.0::numeric, 'u'),
  ('Flanes', 'Cajón de Huevos', 10.0::numeric, 'u'),
  ('Flanes', 'Leche', 1.0::numeric, 'u'),
  ('Flanes', 'Azúcar', 400.0::numeric, 'g'),
  ('Mix de ensalada', 'Rotlem', 500.0::numeric, 'g'),
  ('Mix de ensalada', 'Zanahoria x 10kg', 400.0::numeric, 'g'),
  ('Mix de ensalada', 'Lechuga', 400.0::numeric, 'g'),
  ('Mix de ensalada', 'Repollo', 400.0::numeric, 'g'),
  ('Aderezos Extra', 'Oliva 5L', 243.0::numeric, 'ml'),
  ('Aderezos Extra', 'Aceto 5L', 81.0::numeric, 'ml'),
  ('Aderezos Extra', 'Aceite de 10L', 110.0::numeric, 'ml'),
  ('Aderezos Extra', 'Limón', 69.0::numeric, 'g'),
  ('Aderezos Extra', 'Vinagre 5L', 74.0::numeric, 'ml'),
  ('Aderezos Extra', 'Sal fina x 12', 11.0::numeric, 'g')
) as v(receta_name, insumo_name, qty, unit)
join public.recetas r on r.tenant_id = '2eaa43e4-d06d-4568-bcb3-1720587eddac' and r.name = v.receta_name
join public.insumos i on i.tenant_id = '2eaa43e4-d06d-4568-bcb3-1720587eddac' and i.name = v.insumo_name;

-- Sub-recetas en recetas
insert into public.receta_ingredientes (receta_id, kind, sub_receta_id, qty, unit)
select r.id, 'receta'::ingrediente_kind, s.id, v.qty, v.unit::unit_kind
from (values
  ('Empanadas de Bondiola', 'Relleno de Bondiola', 2.0::numeric, 'kg'),
  ('Empanadas de Bondiola', 'Cebolla rehogada', 3.0::numeric, 'kg'),
  ('Quiche Jamón y Queso', 'Mezcla Base de Quiches', 150.0::numeric, 'g'),
  ('Quiche Jamón y Queso', 'Mix de ensalada', 1.0::numeric, 'porcion'),
  ('Quiche Jamón y Queso', 'Aderezos Extra', 1.0::numeric, 'porcion'),
  ('Quiche Pollo, Verdeo y Panceta', 'Mezcla Base de Quiches', 150.0::numeric, 'g'),
  ('Quiche Pollo, Verdeo y Panceta', 'Mix de ensalada', 1.0::numeric, 'porcion'),
  ('Quiche Pollo, Verdeo y Panceta', 'Aderezos Extra', 1.0::numeric, 'porcion'),
  ('Milanesa', 'Fritas (guarnición)', 1.0::numeric, 'porcion'),
  ('Milanesa', 'Aderezos Extra', 1.0::numeric, 'porcion'),
  ('Milanesa Napo', 'Fritas (guarnición)', 1.0::numeric, 'porcion'),
  ('Milanesa Napo', 'Aderezos Extra', 1.0::numeric, 'porcion'),
  ('Milanesa Napo', 'Salsa Fileto', 1.0::numeric, 'porcion'),
  ('Pastas', 'Pastas', 1.0::numeric, 'porcion'),
  ('Pastas', 'Salsa Fileto', 1.0::numeric, 'porcion')
) as v(receta_name, subreceta_name, qty, unit)
join public.recetas r on r.tenant_id = '2eaa43e4-d06d-4568-bcb3-1720587eddac' and r.name = v.receta_name
join public.recetas s on s.tenant_id = '2eaa43e4-d06d-4568-bcb3-1720587eddac' and s.name = v.subreceta_name;

-- ----- LÍNEAS SIN MAPEAR (revisar a mano) -----
-- Pechuga Curry y Fez <- "Condimentos" (cant: None)
-- Tostado Común <- "Descartables" (cant: None)
-- Tostado Magnolia <- "Descartables" (cant: None)
-- Promo Clásica <- "Café con leche" (cant: None)

-- ============================================================
-- PRODUCTOS (los que tienen receta + pastelería sin receta)
-- ============================================================
do $$
declare
  v_tenant uuid := '2eaa43e4-d06d-4568-bcb3-1720587eddac';
  v_receta_id uuid;
begin
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Empanadas de Carne';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Empanadas de Carne', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Empanadas de Pollo';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Empanadas de Pollo', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Empanadas de J y Q';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Empanadas de J y Q', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Empanadas de Bondiola';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Empanadas de Bondiola', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Rolls de Verdura';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Rolls de Verdura', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Canastitas de Calabaza';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Canastitas de Calabaza', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Empanadas de C y Q';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Empanadas de C y Q', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Canastitas Caprese';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Canastitas Caprese', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Quiche Jamón y Queso';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Quiche Jamón y Queso', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Quiche Pollo, Verdeo y Panceta';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Quiche Pollo, Verdeo y Panceta', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Milanesa';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Milanesa', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Milanesa Napo';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Milanesa Napo', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Pastas';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Pastas', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Pechuga Curry y Fez';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Pechuga Curry y Fez', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Tostado Común';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Tostado Común', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Tostado Magnolia';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Tostado Magnolia', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Licuados';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Licuados', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Limonada';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Limonada', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Promo Clásica';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Promo Clásica', 0, v_receta_id, true);
  select id into v_receta_id from public.recetas where tenant_id = v_tenant and name = 'Flanes';
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Flanes', 0, v_receta_id, true);
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Alfajores de chocolate', 0, null, true);
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Alfajores de Maizena', 0, null, true);
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Lingotes', 0, null, true);
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Minicheesecake', 0, null, true);
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Mini Sacher', 0, null, true);
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Mini Selva Negra', 0, null, true);
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Sopa Inglesa', 0, null, true);
  insert into public.productos (tenant_id, name, sale_price, receta_id, active) values (v_tenant, 'Apple Crumble', 0, null, true);
end $$;

commit;