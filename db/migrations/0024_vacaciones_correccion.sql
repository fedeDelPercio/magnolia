-- 0024_vacaciones_correccion.sql
-- Ajusta `vacaciones_dias_anuales` y carga la vacación faltante de Pau para que
-- el sistema refleje lo que dice el Excel:
--   - Meli: Restan 7 días (15 → 14, tomó 7 → 14-7=7).
--   - Brisa, Nahuel, Pau, Sofi: Completas (anual = días tomados).
--   - Vero, Mayra: ya quedaban en 0 por floor, sin cambio.
--   - Pau (Paula): no tenía vacaciones cargadas; se agrega 23/02-08/03 (14 días).
-- Idempotente.

do $$
declare
  v_tenant uuid := '2eaa43e4-d06d-4568-bcb3-1720587eddac';
  v_id     uuid;
begin
  update public.empleados set vacaciones_dias_anuales = 14
    where tenant_id = v_tenant and name = 'Meli';

  update public.empleados set vacaciones_dias_anuales = 7
    where tenant_id = v_tenant and name = 'Brisa';

  update public.empleados set vacaciones_dias_anuales = 14
    where tenant_id = v_tenant and name = 'Nahuel';

  update public.empleados set vacaciones_dias_anuales = 14
    where tenant_id = v_tenant and name = 'Sofi';

  -- Pau (Paula en el Excel): cargar vacación 2026-02-23 a 2026-03-08 (14 días) y fijar anual.
  select id into v_id from public.empleados where tenant_id = v_tenant and name = 'Pau';
  if v_id is not null then
    update public.empleados set vacaciones_dias_anuales = 14 where id = v_id;
    if not exists (
      select 1 from public.empleado_vacaciones
       where empleado_id = v_id and fecha_desde = '2026-02-23' and fecha_hasta = '2026-03-08'
    ) then
      insert into public.empleado_vacaciones (empleado_id, tenant_id, fecha_desde, fecha_hasta, notas)
        values (v_id, v_tenant, '2026-02-23', '2026-03-08', 'Cargadas del Excel — Completas (14 días)');
    end if;
  end if;
end $$;
