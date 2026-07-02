-- El index parcial de la migracion 0038 (WHERE ref_kind='bistro_tx' AND ref_id
-- IS NOT NULL) no se puede usar como target del ON CONFLICT via el driver de
-- Supabase, porque postgrest no propaga la clausula WHERE al statement. Eso
-- hacia que los upserts de RCA fallaran silenciosamente (el codigo solo
-- logueaba a consola) y los egresos "Ganancia dueños" nunca se creaban.
--
-- Solucion: reemplazarlo por un UNIQUE completo sobre (tenant_id, ref_kind,
-- ref_id). Como Postgres trata NULLs como distintos por default en UNIQUE,
-- multiples rows con ref_kind=NULL/ref_id=NULL (egresos manuales) siguen
-- permitidas. Solo colisionan rows con la misma tripleta no-null.

drop index if exists public.caja_movimientos_bistro_ref_unique;

alter table public.caja_movimientos
  add constraint caja_movimientos_ref_unique
  unique (tenant_id, ref_kind, ref_id);
