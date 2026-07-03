-- Categorias reutilizables para egresos de caja y caja mayor. Caro maneja
-- una lista chica ("Pago a empleados", "Pago a proveedores", "Servicios", etc.)
-- y puede agregar nuevas desde la UI.
--
-- No hay FK desde caja_movimientos/caja_mayor_movimientos.categoria a esta
-- tabla — el campo sigue siendo text libre para no romper los movimientos
-- historicos ni las categorias sintetizadas por el sync ("Ganancia dueños",
-- "Traspaso a caja fuerte", etc.). caja_categorias es la fuente del dropdown
-- en la UI; el user puede escribir cualquier texto si quiere.

create table public.caja_categorias (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_caja_categorias_tenant on public.caja_categorias(tenant_id);
create unique index idx_caja_categorias_tenant_name
  on public.caja_categorias(tenant_id, lower(name));

alter table public.caja_categorias enable row level security;

create policy "caja_categorias_all" on public.caja_categorias
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create trigger caja_categorias_updated_at
  before update on public.caja_categorias
  for each row execute function public.set_updated_at();

-- categoria en caja_mayor_movimientos: hoy la tabla no la tenia (solo tenia
-- tipo, monto, descripcion, source). Agregarla permite clasificar egresos
-- manuales — "Pago a empleados", "Servicios", etc.
alter table public.caja_mayor_movimientos
  add column categoria text;

-- Seed inicial: dos categorias base por cada tenant activo. Idempotente con
-- ON CONFLICT.
insert into public.caja_categorias (tenant_id, name)
select t.id, cat.name
from public.tenants t
cross join (values ('Pago a empleados'), ('Pago a proveedores')) as cat(name)
on conflict (tenant_id, lower(name)) do nothing;
