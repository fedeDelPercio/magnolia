-- ============================================================
-- 0002_catalog.sql
-- Catálogo: proveedores, insumos, recetas, productos
-- Función recipe_cost() y vista product_costs
-- ============================================================

-- ---- Unit enum ---------------------------------------------
create type public.unit_kind as enum ('kg', 'g', 'l', 'ml', 'u', 'docena', 'porcion');

-- ---- Proveedores -------------------------------------------
create table public.proveedores (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  name                text not null,
  contact_name        text,
  contact_phone       text,
  contact_email       text,
  payment_terms_days  int not null default 0,
  notes               text,
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, name)
);

create index idx_proveedores_tenant on public.proveedores(tenant_id);

create trigger proveedores_updated_at
  before update on public.proveedores
  for each row execute function public.set_updated_at();

-- ---- Insumos -----------------------------------------------
create table public.insumos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  unit            public.unit_kind not null,
  current_price   numeric(14,2) not null default 0,
  proveedor_id    uuid references public.proveedores(id) on delete set null,
  perishable      boolean not null default false,
  shelf_life_days int,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, name)
);

create index idx_insumos_tenant    on public.insumos(tenant_id);
create index idx_insumos_proveedor on public.insumos(proveedor_id);

create trigger insumos_updated_at
  before update on public.insumos
  for each row execute function public.set_updated_at();

-- ---- Insumo price history ----------------------------------
create table public.insumo_price_history (
  id          uuid primary key default gen_random_uuid(),
  insumo_id   uuid not null references public.insumos(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  price       numeric(14,2) not null,
  source      text not null check (source in ('manual', 'compra')),
  source_id   uuid,
  valid_from  timestamptz not null default now(),
  created_by  uuid references auth.users(id)
);

create index idx_price_history_insumo on public.insumo_price_history(insumo_id, valid_from desc);
create index idx_price_history_tenant on public.insumo_price_history(tenant_id);

-- Trigger: log price when insumo is created (if price > 0)
create or replace function public.log_insumo_price_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_price > 0 then
    insert into public.insumo_price_history (insumo_id, tenant_id, price, source, created_by)
    values (new.id, new.tenant_id, new.current_price, 'manual', auth.uid());
  end if;
  return new;
end;
$$;

create trigger insumo_price_on_insert
  after insert on public.insumos
  for each row execute function public.log_insumo_price_insert();

-- Trigger: log price when current_price changes on update
create or replace function public.log_insumo_price_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_price <> old.current_price then
    insert into public.insumo_price_history (insumo_id, tenant_id, price, source, created_by)
    values (new.id, new.tenant_id, new.current_price, 'manual', auth.uid());
  end if;
  return new;
end;
$$;

create trigger insumo_price_on_update
  after update on public.insumos
  for each row execute function public.log_insumo_price_change();

-- ---- Recetas -----------------------------------------------
create table public.recetas (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  category    text,
  yield_qty   numeric(14,3) not null default 1,
  yield_unit  public.unit_kind not null default 'u',
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create index idx_recetas_tenant on public.recetas(tenant_id);

create trigger recetas_updated_at
  before update on public.recetas
  for each row execute function public.set_updated_at();

-- ---- Receta ingredientes -----------------------------------
create type public.ingrediente_kind as enum ('insumo', 'receta');

create table public.receta_ingredientes (
  id            uuid primary key default gen_random_uuid(),
  receta_id     uuid not null references public.recetas(id) on delete cascade,
  kind          public.ingrediente_kind not null,
  insumo_id     uuid references public.insumos(id) on delete restrict,
  sub_receta_id uuid references public.recetas(id) on delete restrict,
  qty           numeric(14,3) not null,
  unit          public.unit_kind not null,
  created_at    timestamptz not null default now(),
  constraint chk_ingrediente_ref check (
    (kind = 'insumo' and insumo_id is not null and sub_receta_id is null) or
    (kind = 'receta' and sub_receta_id is not null and insumo_id is null)
  )
);

create index idx_ingredientes_receta     on public.receta_ingredientes(receta_id);
create index idx_ingredientes_insumo     on public.receta_ingredientes(insumo_id);
create index idx_ingredientes_sub_receta on public.receta_ingredientes(sub_receta_id);

-- Cycle detection: prevents circular sub-recipe references
create or replace function public.recipe_has_cycle(p_receta_id uuid, p_sub_receta_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  with recursive deps as (
    select sub_receta_id as id
    from public.receta_ingredientes
    where receta_id = p_sub_receta_id and kind = 'receta'
    union
    select ri.sub_receta_id
    from public.receta_ingredientes ri
    join deps d on d.id = ri.receta_id
    where ri.kind = 'receta'
  )
  select exists(select 1 from deps where id = p_receta_id);
$$;

create or replace function public.check_recipe_cycle()
returns trigger
language plpgsql
as $$
begin
  if new.kind = 'receta' and public.recipe_has_cycle(new.receta_id, new.sub_receta_id) then
    raise exception 'Ciclo detectado: la receta % ya depende de %', new.sub_receta_id, new.receta_id;
  end if;
  return new;
end;
$$;

create trigger receta_ingredientes_cycle_check
  before insert or update on public.receta_ingredientes
  for each row execute function public.check_recipe_cycle();

-- ---- Productos ---------------------------------------------
create table public.productos (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  name              text not null,
  sale_price        numeric(14,2) not null default 0,
  receta_id         uuid references public.recetas(id) on delete set null,
  descartable_cost  numeric(14,2) not null default 0,
  target_margin_pct numeric(5,2) not null default 30,
  is_dynamic        boolean not null default false,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, name)
);

create index idx_productos_tenant on public.productos(tenant_id);
create index idx_productos_receta on public.productos(receta_id);

create trigger productos_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

-- ---- recipe_cost() -----------------------------------------
-- Returns total cost for producing yield_qty of a recipe.
-- Recursively resolves sub-recipes. Cycle detection via trigger prevents infinite recursion.
create or replace function public.recipe_cost(p_receta_id uuid)
returns numeric
language plpgsql
stable
set search_path = public
as $$
declare
  v_cost  numeric := 0;
  v_row   record;
begin
  if p_receta_id is null then
    return 0;
  end if;

  for v_row in
    select
      ri.kind,
      ri.qty,
      i.current_price,
      ri.sub_receta_id,
      r.yield_qty as sub_yield_qty
    from public.receta_ingredientes ri
    left join public.insumos i on i.id = ri.insumo_id
    left join public.recetas r on r.id = ri.sub_receta_id
    where ri.receta_id = p_receta_id
  loop
    if v_row.kind = 'insumo' then
      v_cost := v_cost + v_row.qty * coalesce(v_row.current_price, 0);
    else
      -- cost per unit of sub-recipe = recipe_cost(sub) / yield_qty_of_sub
      v_cost := v_cost + v_row.qty * (
        public.recipe_cost(v_row.sub_receta_id)
        / greatest(coalesce(v_row.sub_yield_qty, 1), 0.001)
      );
    end if;
  end loop;

  return v_cost;
end;
$$;

-- ---- product_costs view ------------------------------------
-- security_invoker = true ensures RLS on underlying tables is respected
create or replace view public.product_costs
with (security_invoker = true)
as
select
  p.id,
  p.tenant_id,
  p.name,
  p.sale_price,
  p.receta_id,
  r.name         as receta_name,
  p.descartable_cost,
  p.target_margin_pct,
  p.is_dynamic,
  p.active,
  coalesce(
    case when p.receta_id is not null then public.recipe_cost(p.receta_id) else 0 end,
    0
  ) + p.descartable_cost as total_cost,
  case
    when p.sale_price > 0 then
      round(
        (1 - (
          coalesce(
            case when p.receta_id is not null then public.recipe_cost(p.receta_id) else 0 end,
            0
          ) + p.descartable_cost
        ) / p.sale_price) * 100,
        2
      )
    else 0
  end as margin_pct
from public.productos p
left join public.recetas r on r.id = p.receta_id;

-- ---- RLS: proveedores --------------------------------------
alter table public.proveedores enable row level security;

create policy "proveedores_all" on public.proveedores
  for all
  using     (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- ---- RLS: insumos ------------------------------------------
alter table public.insumos enable row level security;

create policy "insumos_all" on public.insumos
  for all
  using     (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- ---- RLS: insumo_price_history -----------------------------
alter table public.insumo_price_history enable row level security;

create policy "price_history_select" on public.insumo_price_history
  for select using (tenant_id in (select public.current_tenant_ids()));

create policy "price_history_insert" on public.insumo_price_history
  for insert with check (tenant_id in (select public.current_tenant_ids()));

-- ---- RLS: recetas ------------------------------------------
alter table public.recetas enable row level security;

create policy "recetas_all" on public.recetas
  for all
  using     (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- ---- RLS: receta_ingredientes ------------------------------
-- No tenant_id column — isolated via the parent receta
alter table public.receta_ingredientes enable row level security;

create policy "ingredientes_all" on public.receta_ingredientes
  for all
  using (
    receta_id in (
      select id from public.recetas
      where tenant_id in (select public.current_tenant_ids())
    )
  )
  with check (
    receta_id in (
      select id from public.recetas
      where tenant_id in (select public.current_tenant_ids())
    )
  );

-- ---- RLS: productos ----------------------------------------
alter table public.productos enable row level security;

create policy "productos_all" on public.productos
  for all
  using     (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));
