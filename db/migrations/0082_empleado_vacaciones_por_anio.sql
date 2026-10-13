-- Días de vacaciones que le corresponden a cada empleado, por año.
--
-- Lo que le corresponde cambia con el tiempo (alguien que entró hace poco
-- tiene 2 días este año y 14 el que viene). Con un solo número en empleados,
-- cambiarlo reescribía también los años anteriores.
--
-- Cuánto le corresponde en un año = la fila de ese año; si no hay, la del año
-- anterior más cercano (un cambio sigue valiendo para los años siguientes
-- hasta que se cambie de nuevo); si no hay ninguna,
-- empleados.vacaciones_dias_anuales (el valor con el que se dio de alta).

create table if not exists public.empleado_vacaciones_anuales (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  anio integer not null check (anio between 2000 and 2100),
  dias integer not null check (dias between 0 and 60),
  updated_at timestamptz not null default now(),
  unique (empleado_id, anio)
);

create index if not exists idx_empleado_vacaciones_anuales_tenant
  on public.empleado_vacaciones_anuales (tenant_id, anio);

alter table public.empleado_vacaciones_anuales enable row level security;
drop policy if exists empleado_vacaciones_anuales_all on public.empleado_vacaciones_anuales;
create policy empleado_vacaciones_anuales_all on public.empleado_vacaciones_anuales
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));
