-- 0048_proveedores_servicios.sql
--
-- Introduce el tipo "servicio" para proveedores (default sigue siendo "insumo"
-- para que todos los existentes queden como insumo). Los servicios tienen sus
-- propios conceptos (ej: Internet 500MB de Fibertel, Luz de Edenor) y pagos
-- puntuales que sirven para trackear el incremento de precios en el tiempo.
--
-- No se toca la logica de compras/pagos existentes — los proveedores de
-- servicios usan una tabla nueva (proveedor_servicio_pagos), no compras.

-- Enum del tipo de proveedor
do $$
begin
  if not exists (select 1 from pg_type where typname = 'proveedor_tipo') then
    create type public.proveedor_tipo as enum ('insumo', 'servicio');
  end if;
end$$;

-- Columna tipo en proveedores (default insumo — backfill implicito)
alter table public.proveedores
  add column if not exists tipo public.proveedor_tipo not null default 'insumo';

-- Conceptos del proveedor (solo aplica a tipo=servicio, pero no fuerzo el
-- constraint asi permito que en el futuro insumos tambien tengan conceptos
-- si hace falta). El check de tipo se hace en la UI y en las actions.
create table if not exists public.proveedor_conceptos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_proveedor_conceptos_unique
  on public.proveedor_conceptos (proveedor_id, lower(name));

create index if not exists idx_proveedor_conceptos_proveedor
  on public.proveedor_conceptos (proveedor_id);

alter table public.proveedor_conceptos enable row level security;

drop policy if exists "proveedor_conceptos_all" on public.proveedor_conceptos;
create policy "proveedor_conceptos_all" on public.proveedor_conceptos
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

-- Pagos de servicios: 1 fila por pago, con concepto opcional (para permitir
-- pagos "sueltos" mientras se van dando de alta los conceptos). El monto es el
-- "precio" del servicio en esa fecha, para trackear incrementos.
create table if not exists public.proveedor_servicio_pagos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  concepto_id uuid references public.proveedor_conceptos(id) on delete set null,
  fecha date not null,
  monto numeric(12,2) not null check (monto >= 0),
  notas text,
  caja_movimiento_id uuid references public.caja_movimientos(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_prov_serv_pagos_proveedor_fecha
  on public.proveedor_servicio_pagos (proveedor_id, fecha desc);

create index if not exists idx_prov_serv_pagos_concepto_fecha
  on public.proveedor_servicio_pagos (concepto_id, fecha desc)
  where concepto_id is not null;

alter table public.proveedor_servicio_pagos enable row level security;

drop policy if exists "proveedor_servicio_pagos_all" on public.proveedor_servicio_pagos;
create policy "proveedor_servicio_pagos_all" on public.proveedor_servicio_pagos
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));
