-- Vista que expone el total_cost calculado por recipe_cost() para cada receta.
-- El frontend la consulta con un solo select en vez de hacer N+1 RPCs.
create or replace view public.receta_costs
with (security_invoker = true)
as
select
  r.id,
  r.tenant_id,
  r.name,
  r.yield_qty,
  r.yield_unit,
  r.active,
  public.recipe_cost(r.id) as total_cost
from public.recetas r;
