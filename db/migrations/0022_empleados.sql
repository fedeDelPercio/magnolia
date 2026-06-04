-- 0022_empleados.sql
-- Módulo Empleados: gestión de personal, asistencias por excepción y liquidación que genera egresos en caja.

-- A) empleados ---------------------------------------------------------------
create table public.empleados (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  name                    text not null,
  fecha_ingreso           date,
  sueldo_diario           numeric(12,2) not null default 0,
  plus_mensual            numeric(12,2) not null default 0,
  aguinaldo_estimado      numeric(12,2) not null default 0,
  vacaciones_dias_anuales smallint not null default 14,
  activo                  boolean not null default true,
  notas                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index idx_empleados_tenant_activo on public.empleados(tenant_id, activo);
alter table public.empleados enable row level security;
create policy "empleados_all" on public.empleados
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- B) empleado_horarios -------------------------------------------------------
create table public.empleado_horarios (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  dow         smallint not null check (dow between 0 and 6),
  hora_inicio time not null,
  hora_fin    time not null
);
create index idx_horarios_empleado on public.empleado_horarios(empleado_id);
alter table public.empleado_horarios enable row level security;
create policy "empleado_horarios_all" on public.empleado_horarios
  for all using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- C) empleado_vacaciones -----------------------------------------------------
create table public.empleado_vacaciones (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  fecha_desde date not null,
  fecha_hasta date not null,
  notas       text,
  created_at  timestamptz not null default now(),
  check (fecha_hasta >= fecha_desde)
);
create index idx_vac_empleado on public.empleado_vacaciones(empleado_id, fecha_desde);
alter table public.empleado_vacaciones enable row level security;
create policy "empleado_vacaciones_all" on public.empleado_vacaciones
  for all using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- D) empleado_ausencias ------------------------------------------------------
create table public.empleado_ausencias (
  id          uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  fecha       date not null,
  tipo        text not null check (tipo in ('justificada','injustificada','enfermedad','feriado','licencia')),
  paga        boolean not null default false,
  notas       text,
  created_at  timestamptz not null default now(),
  unique (empleado_id, fecha)
);
alter table public.empleado_ausencias enable row level security;
create policy "empleado_ausencias_all" on public.empleado_ausencias
  for all using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- E) empleado_liquidaciones --------------------------------------------------
create table public.empleado_liquidaciones (
  id                   uuid primary key default gen_random_uuid(),
  empleado_id          uuid not null references public.empleados(id) on delete cascade,
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  fecha_desde          date not null,
  fecha_hasta          date not null,
  dias_programados     smallint not null,
  dias_trabajados      smallint not null,
  dias_ausentes_pagos  smallint not null,
  monto_sueldo         numeric(12,2) not null,
  monto_plus           numeric(12,2) not null default 0,
  monto_total          numeric(12,2) generated always as (monto_sueldo + monto_plus) stored,
  caja_movimiento_id   uuid references public.caja_movimientos(id) on delete set null,
  notas                text,
  created_at           timestamptz not null default now()
);
create index idx_liq_empleado on public.empleado_liquidaciones(empleado_id, fecha_desde desc);
alter table public.empleado_liquidaciones enable row level security;
create policy "empleado_liquidaciones_all" on public.empleado_liquidaciones
  for all using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- F) Seed inicial con los 8 empleados del Excel actual -----------------------
-- Se insertan en el tenant "Magnolia Demo" (donde se loguea demo@magnolia.com para QA).
-- El seed es idempotente: re-aplicar la migración no duplica filas (chequeo por nombre + tenant).
do $$
declare
  v_tenant uuid := '2eaa43e4-d06d-4568-bcb3-1720587eddac';
  v_id     uuid;
begin
  -- Pau ---------------------------------------------------------------------
  if not exists (select 1 from public.empleados where tenant_id = v_tenant and name = 'Pau') then
    insert into public.empleados (tenant_id, name, fecha_ingreso, sueldo_diario, plus_mensual, aguinaldo_estimado, vacaciones_dias_anuales)
      values (v_tenant, 'Pau', '2025-04-21', 35000, 0, 350000, 14) returning id into v_id;
    insert into public.empleado_horarios (empleado_id, tenant_id, dow, hora_inicio, hora_fin)
      select v_id, v_tenant, d, '08:00', '14:00' from generate_series(1,6) d;
  end if;

  -- Sofi --------------------------------------------------------------------
  if not exists (select 1 from public.empleados where tenant_id = v_tenant and name = 'Sofi') then
    insert into public.empleados (tenant_id, name, fecha_ingreso, sueldo_diario, plus_mensual, aguinaldo_estimado, vacaciones_dias_anuales)
      values (v_tenant, 'Sofi', '2025-01-01', 26000, 250000, 437000, 15) returning id into v_id;
    insert into public.empleado_horarios (empleado_id, tenant_id, dow, hora_inicio, hora_fin)
      select v_id, v_tenant, d, '13:00', '21:00' from generate_series(1,6) d;
    insert into public.empleado_vacaciones (empleado_id, tenant_id, fecha_desde, fecha_hasta, notas)
      values (v_id, v_tenant, '2026-01-16', '2026-01-29', 'Cargadas del Excel — Vacaciones 2026 completas');
  end if;

  -- Meli --------------------------------------------------------------------
  if not exists (select 1 from public.empleados where tenant_id = v_tenant and name = 'Meli') then
    insert into public.empleados (tenant_id, name, fecha_ingreso, sueldo_diario, plus_mensual, aguinaldo_estimado, vacaciones_dias_anuales)
      values (v_tenant, 'Meli', '2021-11-01', 26000, 250000, 437000, 15) returning id into v_id;
    insert into public.empleado_horarios (empleado_id, tenant_id, dow, hora_inicio, hora_fin)
      select v_id, v_tenant, d, '08:00', '16:00' from generate_series(1,6) d;
    insert into public.empleado_vacaciones (empleado_id, tenant_id, fecha_desde, fecha_hasta, notas)
      values (v_id, v_tenant, '2026-01-19', '2026-01-25', 'Cargadas del Excel — Restan 7 días');
  end if;

  -- Vero --------------------------------------------------------------------
  -- No tenía horario en el Excel; se carga sin horarios (admin lo completa luego).
  if not exists (select 1 from public.empleados where tenant_id = v_tenant and name = 'Vero') then
    insert into public.empleados (tenant_id, name, fecha_ingreso, sueldo_diario, plus_mensual, aguinaldo_estimado, vacaciones_dias_anuales)
      values (v_tenant, 'Vero', '2024-04-01', 30000, 0, 300000, 7) returning id into v_id;
    insert into public.empleado_vacaciones (empleado_id, tenant_id, fecha_desde, fecha_hasta, notas)
      values (v_id, v_tenant, '2026-02-02', '2026-02-09', 'Cargadas del Excel — Completas (7 días)');
  end if;

  -- Nahuel ------------------------------------------------------------------
  if not exists (select 1 from public.empleados where tenant_id = v_tenant and name = 'Nahuel') then
    insert into public.empleados (tenant_id, name, fecha_ingreso, sueldo_diario, plus_mensual, aguinaldo_estimado, vacaciones_dias_anuales)
      values (v_tenant, 'Nahuel', '2025-05-01', 26000, 150000, 387000, 15) returning id into v_id;
    insert into public.empleado_horarios (empleado_id, tenant_id, dow, hora_inicio, hora_fin)
      select v_id, v_tenant, d, '08:00', '16:00' from generate_series(1,6) d;
    -- Excel tenía "26/02 al 8/02" (claro typo). Interpretamos 26/01 a 08/02 (15 días).
    insert into public.empleado_vacaciones (empleado_id, tenant_id, fecha_desde, fecha_hasta, notas)
      values (v_id, v_tenant, '2026-01-26', '2026-02-08', 'Cargadas del Excel — typo "26/02 al 8/02" interpretado como 15 días');
  end if;

  -- Brisa -------------------------------------------------------------------
  if not exists (select 1 from public.empleados where tenant_id = v_tenant and name = 'Brisa') then
    insert into public.empleados (tenant_id, name, fecha_ingreso, sueldo_diario, plus_mensual, aguinaldo_estimado, vacaciones_dias_anuales)
      values (v_tenant, 'Brisa', null, 26000, 200000, 412000, 15) returning id into v_id;
    insert into public.empleado_horarios (empleado_id, tenant_id, dow, hora_inicio, hora_fin)
      select v_id, v_tenant, d, '08:00', '16:00' from generate_series(1,6) d;
    insert into public.empleado_vacaciones (empleado_id, tenant_id, fecha_desde, fecha_hasta, notas)
      values (v_id, v_tenant, '2026-01-12', '2026-01-18', 'Cargadas del Excel — Completas');
  end if;

  -- Mayra -------------------------------------------------------------------
  if not exists (select 1 from public.empleados where tenant_id = v_tenant and name = 'Mayra') then
    insert into public.empleados (tenant_id, name, fecha_ingreso, sueldo_diario, plus_mensual, aguinaldo_estimado, vacaciones_dias_anuales)
      values (v_tenant, 'Mayra', '2023-06-01', 26000, 100000, 362000, 2) returning id into v_id;
    insert into public.empleado_horarios (empleado_id, tenant_id, dow, hora_inicio, hora_fin)
      select v_id, v_tenant, d, '08:00', '16:00' from generate_series(1,6) d;
    insert into public.empleado_vacaciones (empleado_id, tenant_id, fecha_desde, fecha_hasta, notas)
      values (v_id, v_tenant, '2026-01-09', '2026-01-11', 'Cargadas del Excel — Completas (2 días)');
  end if;

  -- Marie -------------------------------------------------------------------
  -- L-V 15-21 + Sábado 13-20 (segunda fila del Excel con horario extra).
  if not exists (select 1 from public.empleados where tenant_id = v_tenant and name = 'Marie') then
    insert into public.empleados (tenant_id, name, fecha_ingreso, sueldo_diario, plus_mensual, aguinaldo_estimado, vacaciones_dias_anuales)
      values (v_tenant, 'Marie', '2025-11-01', 25000, 50000, 275000, 14) returning id into v_id;
    insert into public.empleado_horarios (empleado_id, tenant_id, dow, hora_inicio, hora_fin)
      select v_id, v_tenant, d, '15:00', '21:00' from generate_series(1,5) d;
    insert into public.empleado_horarios (empleado_id, tenant_id, dow, hora_inicio, hora_fin)
      values (v_id, v_tenant, 6, '13:00', '20:00');
  end if;
end $$;
