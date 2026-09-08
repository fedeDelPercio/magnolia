-- Unicidad de nombres insensible a mayusculas/minusculas y espacios al borde.
--
-- Las tablas del catalogo tenian unique(tenant_id, name), que es case-sensitive:
-- "Cebolla" y "cebolla" (o "Agua" y "Agua ") convivian como dos insumos
-- distintos y la clienta terminaba con duplicados por tipeo. Se agrega un
-- indice unico sobre lower(trim(name)), ADEMAS del constraint existente (no
-- se toca nada de lo que ya habia). Mismo criterio que ya usaba
-- producto_conceptos (idx_conceptos_tenant_name, migracion 0044).
--
-- Antes de aplicar se limpio la unica colision existente (receta
-- "Sandwich de Chipá" duplicada por un espacio final) y se recortaron los
-- 8 nombres con espacios al final.

create unique index if not exists idx_insumos_tenant_name_ci
  on public.insumos (tenant_id, lower(trim(name)));

create unique index if not exists idx_recetas_tenant_name_ci
  on public.recetas (tenant_id, lower(trim(name)));

create unique index if not exists idx_productos_tenant_name_ci
  on public.productos (tenant_id, lower(trim(name)));

create unique index if not exists idx_proveedores_tenant_name_ci
  on public.proveedores (tenant_id, lower(trim(name)));
