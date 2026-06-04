-- 0023_empleado_vacaciones_cancelada.sql
-- Agrega flag de cancelación a las tomas de vacaciones. Los demás estados
-- (planificadas / en curso / completas) se derivan por fecha en cada query
-- — no necesitan persistirse.

alter table public.empleado_vacaciones
  add column cancelada boolean not null default false;

-- Index parcial para queries del tipo "días tomados del año" que ignoran las canceladas.
create index idx_vacaciones_no_canceladas
  on public.empleado_vacaciones(empleado_id, fecha_desde)
  where not cancelada;
