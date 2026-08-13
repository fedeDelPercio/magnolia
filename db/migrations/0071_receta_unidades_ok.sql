-- Detección de recetas con unidades incompatibles (ej. consumir "500 ml" de
-- un insumo que se mide en "u", o "3 u" de uno en kg). En esos casos no hay
-- conversión posible y el costo calculado es ruido — la Limonada daba $376.053
-- por 500 ml de agua embotellada medida en unidades. El dashboard usa esto
-- para excluir esos productos del Menu Engineering (con nota visible) hasta
-- que se corrijan las recetas; el editor ya marca las líneas con warning.

create or replace function public.receta_unidades_ok(p_receta_id uuid)
returns boolean
language sql
stable
set search_path to 'public'
as $function$
  with recursive fam(u, fam) as (
    values ('kg','peso'), ('g','peso'), ('l','vol'), ('ml','vol'),
           ('u','cant'), ('docena','cant'), ('porcion','porcion')
  ),
  tree as (
    select ri.kind, ri.insumo_id, ri.sub_receta_id, ri.unit, 0 as depth
    from receta_ingredientes ri
    where ri.receta_id = p_receta_id
    union all
    select ri2.kind, ri2.insumo_id, ri2.sub_receta_id, ri2.unit, t.depth + 1
    from tree t
    join receta_ingredientes ri2 on ri2.receta_id = t.sub_receta_id
    where t.kind = 'receta' and t.depth < 10
  )
  select not exists (
    select 1
    from tree t
    left join insumos i on i.id = t.insumo_id
    left join recetas r on r.id = t.sub_receta_id
    left join fam f1 on f1.u = t.unit::text
    left join fam f2 on f2.u = coalesce(i.unit::text, r.yield_unit::text)
    where t.unit::text is distinct from coalesce(i.unit::text, r.yield_unit::text)
      and coalesce(f1.fam, '?consumo') <> coalesce(f2.fam, '?real')
  );
$function$;

create or replace function public.productos_unidades_rotas(p_tenant_id uuid)
returns table(producto_id uuid)
language sql
stable
set search_path to 'public'
as $function$
  select p.id
  from productos p
  where p.tenant_id = p_tenant_id
    and p.receta_id is not null
    and not public.receta_unidades_ok(p.receta_id)
$function$;
