-- Caja Mayor: tesoreria del local separada de la caja del POS (Bistro).
-- Su saldo arranca en 0. Los ingresos llegan automaticamente cuando se
-- detecte un retiro tipo "CAJA MAYOR" en Bistro (source='bistro' +
-- bistro_tx_id linkeado para no duplicar). Los egresos se cargan a mano
-- desde la UI cuando alguien saca plata por fuera de Bistro.

create table public.caja_mayor_movimientos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  fecha date not null,
  tipo text not null check (tipo in ('ingreso','egreso')),
  monto numeric(12,2) not null check (monto > 0),
  descripcion text,
  source text not null default 'manual' check (source in ('manual','bistro')),
  bistro_tx_id uuid references public.bistro_transacciones(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  -- Si viene de Bistro, no permitir duplicar el mismo tx_id como ingreso a caja mayor
  unique (bistro_tx_id)
);

create index idx_caja_mayor_tenant_fecha
  on public.caja_mayor_movimientos(tenant_id, fecha desc);

alter table public.caja_mayor_movimientos enable row level security;

create policy caja_mayor_all on public.caja_mayor_movimientos
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));
