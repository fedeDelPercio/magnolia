-- 0008_insumos_kind_descartables.sql
-- Reemplaza el campo manual descartable_cost en productos por una tabla
-- producto_descartables donde se seleccionan insumos con kind='descartable'.
-- El costo se calcula automáticamente como sum(qty × insumo.current_price).
--
-- Cambios:
--   1. insumos.kind: 'ingrediente' | 'descartable' (default 'ingrediente')
--   2. tabla producto_descartables con RLS
--   3. product_costs view: descartable_cost pasa a ser calculado, no almacenado
--   4. drop productos.descartable_cost

-- 1. Tipo de insumo
alter table public.insumos
  add column kind text not null default 'ingrediente'
  check (kind in ('ingrediente', 'descartable'));

-- 2. Tabla de descartables por producto
create table public.producto_descartables (
  id          uuid        primary key default gen_random_uuid(),
  producto_id uuid        not null references public.productos(id) on delete cascade,
  insumo_id   uuid        not null references public.insumos(id) on delete restrict,
  qty         numeric(14,3) not null check (qty > 0),
  created_at  timestamptz not null default now()
);

alter table public.producto_descartables enable row level security;

create policy "tenant isolation" on public.producto_descartables
  for all
  using (
    producto_id in (
      select id from public.productos
      where tenant_id in (select public.current_tenant_ids())
    )
  )
  with check (
    producto_id in (
      select id from public.productos
      where tenant_id in (select public.current_tenant_ids())
    )
  );

-- Índice para lookup por producto
create index on public.producto_descartables (producto_id);

-- 3. Actualizar product_costs: descartable_cost calculado desde la tabla
create or replace view public.product_costs
with (security_invoker = true)
as
select
  p.id,
  p.tenant_id,
  p.name,
  p.sale_price,
  p.receta_id,
  r.name  as receta_name,
  p.target_margin_pct,
  p.is_dynamic,
  p.active,
  -- costo ingredientes (recipe / yield)
  coalesce(
    case
      when p.receta_id is not null and r.yield_qty > 0
        then recipe_cost(p.receta_id) / r.yield_qty
      else 0::numeric
    end,
    0::numeric
  ) as ingredient_cost,
  -- costo descartables calculado
  coalesce((
    select sum(pd.qty * i.current_price)
    from   public.producto_descartables pd
    join   public.insumos i on i.id = pd.insumo_id
    where  pd.producto_id = p.id
  ), 0::numeric) as descartable_cost,
  -- total
  coalesce(
    case
      when p.receta_id is not null and r.yield_qty > 0
        then recipe_cost(p.receta_id) / r.yield_qty
      else 0::numeric
    end,
    0::numeric
  ) + coalesce((
    select sum(pd.qty * i.current_price)
    from   public.producto_descartables pd
    join   public.insumos i on i.id = pd.insumo_id
    where  pd.producto_id = p.id
  ), 0::numeric) as total_cost,
  -- margen
  case
    when p.sale_price > 0::numeric then
      round(
        (1::numeric - (
          coalesce(
            case
              when p.receta_id is not null and r.yield_qty > 0
                then recipe_cost(p.receta_id) / r.yield_qty
              else 0::numeric
            end,
            0::numeric
          ) + coalesce((
            select sum(pd.qty * i.current_price)
            from   public.producto_descartables pd
            join   public.insumos i on i.id = pd.insumo_id
            where  pd.producto_id = p.id
          ), 0::numeric)
        ) / p.sale_price) * 100::numeric,
        2
      )
    else 0::numeric
  end as margin_pct
from       public.productos p
left join  public.recetas   r on r.id = p.receta_id;

-- 4. Drop descartable_cost de productos (ya no se almacena, se calcula)
alter table public.productos drop column descartable_cost;
