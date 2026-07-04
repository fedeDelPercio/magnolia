-- Cambiar el default de insumos.track_stock a true. Los insumos existentes
-- ya se activaron caso por caso en cada tenant; a partir de esta migracion,
-- cualquier insumo nuevo viene con control de stock encendido por default.
-- El usuario puede desactivarlo desde el diálogo si no le interesa trackear
-- ese insumo puntual (perishables, cosas que van directo a mesa, etc.).

alter table public.insumos
  alter column track_stock set default true;
