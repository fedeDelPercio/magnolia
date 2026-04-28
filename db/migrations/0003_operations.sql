-- ============================================================
-- 0003_operations.sql
-- Operación diaria: dias_operativos + movimientos_diarios
-- ============================================================

-- ---- Status enum -------------------------------------------
create type public.dia_status as enum ('abierto', 'cerrado');

-- ---- Dias operativos ----------------------------------------
create table public.dias_operativos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  fecha       date not null,
  status      public.dia_status not null default 'abierto',
  notes       text,
  closed_at   timestamptz,
  closed_by   uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, fecha)
);

create index idx_dias_tenant_fecha on public.dias_operativos(tenant_id, fecha desc);

create trigger dias_operativos_updated_at
  before update on public.dias_operativos
  for each row execute function public.set_updated_at();

alter table public.dias_operativos enable row level security;

create policy "dias_all" on public.dias_operativos
  for all
  using     (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- ---- Movimientos diarios ------------------------------------
create table public.movimientos_diarios (
  id              uuid primary key default gen_random_uuid(),
  dia_id          uuid not null references public.dias_operativos(id) on delete cascade,
  producto_id     uuid not null references public.productos(id) on delete restrict,
  produccion      numeric(14,3) not null default 0,
  ventas          numeric(14,3) not null default 0,
  desperdicio     numeric(14,3) not null default 0,
  almuerzo        numeric(14,3) not null default 0,
  conteo_fisico   numeric(14,3),
  stock_anterior  numeric(14,3) not null default 0,
  stock_calculado numeric(14,3),
  diferencia      numeric(14,3),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (dia_id, producto_id)
);

create index idx_movimientos_dia     on public.movimientos_diarios(dia_id);
create index idx_movimientos_producto on public.movimientos_diarios(producto_id);

create trigger movimientos_diarios_updated_at
  before update on public.movimientos_diarios
  for each row execute function public.set_updated_at();

alter table public.movimientos_diarios enable row level security;

create policy "movimientos_all" on public.movimientos_diarios
  for all
  using (
    dia_id in (
      select id from public.dias_operativos
      where tenant_id in (select public.current_tenant_ids())
    )
  )
  with check (
    dia_id in (
      select id from public.dias_operativos
      where tenant_id in (select public.current_tenant_ids())
    )
  );

-- ---- Function: abrir_dia ------------------------------------
create or replace function public.abrir_dia(p_tenant_id uuid, p_fecha date)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia_id uuid;
  v_prod   record;
  v_stock_ant numeric;
begin
  if p_tenant_id not in (select public.current_tenant_ids()) then
    raise exception 'Acceso denegado';
  end if;

  insert into public.dias_operativos (tenant_id, fecha)
  values (p_tenant_id, p_fecha)
  returning id into v_dia_id;

  for v_prod in
    select id from public.productos
    where tenant_id = p_tenant_id and active = true
    order by name
  loop
    select coalesce(md.stock_calculado, 0) into v_stock_ant
    from public.movimientos_diarios md
    join public.dias_operativos d on d.id = md.dia_id
    where md.producto_id = v_prod.id
      and d.tenant_id    = p_tenant_id
      and d.status       = 'cerrado'
      and d.fecha        < p_fecha
    order by d.fecha desc
    limit 1;

    insert into public.movimientos_diarios (dia_id, producto_id, stock_anterior)
    values (v_dia_id, v_prod.id, coalesce(v_stock_ant, 0));
  end loop;

  return v_dia_id;
end;
$$;

-- ---- Function: cerrar_dia -----------------------------------
create or replace function public.cerrar_dia(p_dia_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.dias_operativos
  where id = p_dia_id;

  if v_tenant_id not in (select public.current_tenant_ids()) then
    raise exception 'Acceso denegado';
  end if;

  update public.movimientos_diarios
  set
    stock_calculado = stock_anterior + produccion - ventas - desperdicio - almuerzo,
    diferencia      = case
                        when conteo_fisico is not null
                        then conteo_fisico - (stock_anterior + produccion - ventas - desperdicio - almuerzo)
                        else null
                      end
  where dia_id = p_dia_id;

  update public.dias_operativos
  set status    = 'cerrado',
      closed_at = now(),
      closed_by = auth.uid()
  where id = p_dia_id;
end;
$$;
