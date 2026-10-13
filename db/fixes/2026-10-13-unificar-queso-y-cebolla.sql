-- Unificar "Queso y Cebolla" (Magnolia Demo) — 2026-10-13
--
-- Había dos productos para la misma empanada:
--   * "Emapanada de Queso y Cebolla" (+ Delivery y Menú): el bueno. Recibe las
--     ventas de Bistro, tiene receta e historial. El nombre tenía un error de
--     tipeo ("Emapanada") y por eso no aparecía al buscar "emp".
--   * "Empanadas de C y Q" (+ Delivery): un duplicado que no recibe nada de
--     Bistro y se cargaba a mano.
--
-- Qué hace:
--   1. Corrige el nombre del bueno (y de sus recetas) a "Empanadas de Queso y Cebolla".
--   2. Desactiva el duplicado "C y Q" (no se borra: queda su historial).
--   3. Saca de los días abiertos las filas vacías del duplicado (dejan de verse en Operación).
--   4. 07/10: la misma producción (6) y ventas se cargaron en los dos productos;
--      se dejan solo en el bueno (si no, los ingredientes se descontaban dos veces).
--
-- Aplicado el 2026-10-13 con `supabase db query --linked`. Si algo no da lo esperado,
-- corta con un error y no se aplica nada.

begin;

do $$
declare
  demo constant uuid := '2eaa43e4-d06d-4568-bcb3-1720587eddac';
  n integer;
begin
  -- 1) Nombre correcto
  update public.productos set name = 'Empanadas de Queso y Cebolla'
   where id = '6e4eae55-4867-4098-8d6e-77abaacbb849' and tenant_id = demo and name = 'Emapanada de Queso y Cebolla';
  get diagnostics n = row_count; if n <> 1 then raise exception 'Paso 1a: se esperaba 1 producto, hubo %', n; end if;

  update public.productos set name = 'Empanadas de Queso y Cebolla Delivery'
   where id = 'e7cb8fbc-91c6-460c-ac30-560ca3f26012' and tenant_id = demo and name = 'Emapanada de Queso y Cebolla Delivery';
  get diagnostics n = row_count; if n <> 1 then raise exception 'Paso 1b: se esperaba 1 producto, hubo %', n; end if;

  update public.productos set name = 'Menú Empanadas de Queso y Cebolla'
   where id = 'c2df53ab-3897-46a4-9f2a-468ab04c61b1' and tenant_id = demo and name = 'Menú Emapanada de Queso y Cebolla';
  get diagnostics n = row_count; if n <> 1 then raise exception 'Paso 1c: se esperaba 1 producto, hubo %', n; end if;

  update public.recetas set name = replace(name, 'Emapanada de Queso y Cebolla', 'Empanadas de Queso y Cebolla')
   where id in ('e0599c41-33c4-4d6e-8d0a-340009c4f7d0', '75d24f73-28b3-44d1-bf61-b46ef0a575bc', '1df3087d-eb7d-4efd-9762-08dc7b3655b8')
     and name like '%Emapanada de Queso y Cebolla%';

  -- 2) Duplicado fuera de uso
  update public.productos set active = false
   where id in ('fac65aa2-4358-481c-92e1-9805ac709399', 'b51171f3-b211-49e4-9945-b827257f84b5') and tenant_id = demo;
  get diagnostics n = row_count; if n <> 2 then raise exception 'Paso 2: se esperaban 2 productos, hubo %', n; end if;

  -- 3) Filas vacías del duplicado en días abiertos
  delete from public.movimientos_diarios m
   using public.dias_operativos d
   where d.id = m.dia_id and d.tenant_id = demo and d.status = 'abierto'
     and m.producto_id in ('fac65aa2-4358-481c-92e1-9805ac709399', 'b51171f3-b211-49e4-9945-b827257f84b5')
     and m.produccion = 0 and m.ventas = 0 and m.desperdicio = 0 and m.almuerzo = 0
     and m.conteo_fisico is null and m.stock_anterior = 0;

  -- 4) 07/10: lo cargado dos veces queda solo en el producto bueno
  update public.movimientos_diarios m
     set produccion = 0, ventas = 0, almuerzo = 0, conteo_fisico = null
    from public.dias_operativos d
   where d.id = m.dia_id and d.tenant_id = demo and d.fecha = '2026-10-07'
     and m.producto_id = 'fac65aa2-4358-481c-92e1-9805ac709399'
     and m.produccion = 6 and m.ventas = 6;
  get diagnostics n = row_count; if n <> 1 then raise exception 'Paso 4: se esperaba 1 fila del 07/10, hubo %', n; end if;
end $$;

commit;

-- Control (opcional): tiene que mostrar los 3 productos con el nombre nuevo y los 2 "C y Q" inactivos.
select name, active from public.productos
 where tenant_id = '2eaa43e4-d06d-4568-bcb3-1720587eddac'
   and (name ilike '%queso y cebolla%' or name ilike '%c y q%')
 order by name;
