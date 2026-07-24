-- Menu de la semana con dimension de semana calendario.
--
-- Antes: receta_del_dia estaba keyed solo por dia de la semana
-- (unique(tenant_id, dow)) => una sola fila por dia, un unico ciclo global.
-- Editar "la proxima semana" pisaba la semana en curso porque compartian slot.
--
-- Ahora agregamos `week_start` (el LUNES de la semana). La clave pasa a ser
-- (tenant_id, week_start, dow), asi cada semana tiene sus 7 dias propios.
-- La "semana actual" se calcula con la fecha de hoy en la app, por lo que
-- rota sola cada lunes sin cron.
--
-- Backfill: las filas existentes (el ciclo unico previo) se asignan a la
-- semana EN CURSO para que no se pierda lo cargado. Las semanas pasadas quedan
-- vacias (no habia historial por semana). date_trunc('week', ...) en Postgres
-- arranca el lunes, igual que el resto de la app.

alter table public.receta_del_dia add column week_start date;

update public.receta_del_dia
  set week_start = date_trunc('week', current_date)::date
  where week_start is null;

alter table public.receta_del_dia alter column week_start set not null;

alter table public.receta_del_dia drop constraint receta_del_dia_tenant_id_dow_key;

create unique index receta_del_dia_tenant_week_dow_key
  on public.receta_del_dia (tenant_id, week_start, dow);

create index idx_receta_del_dia_week
  on public.receta_del_dia (tenant_id, week_start);
