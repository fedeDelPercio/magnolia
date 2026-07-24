-- Fondo de emergencia: tercera cuenta (ledger propio) junto a Caja Mayor y
-- Cuenta Digital. Guarda ingresos y egresos. Los traspasos DESDE caja mayor o
-- medios digitales se modelan como UN solo ingreso a este fondo con `origen`
-- apuntando a la cuenta de la que salio la plata; esa misma fila se lee desde
-- la cuenta de origen como egreso (doble asiento con una sola fila, igual que
-- el traspaso digital -> caja mayor ya existente). Asi borrar el traspaso
-- devuelve la plata sola a la cuenta de origen.

create table public.fondo_emergencia_movimientos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  fecha       date not null,
  tipo        text not null check (tipo in ('ingreso', 'egreso')),
  monto       numeric(12,2) not null check (monto > 0),
  descripcion text,
  categoria   text,
  -- Solo relevante en ingresos: de que cuenta salio la plata que entra al
  -- fondo. 'externo' = aporte de afuera (no descuenta otra cuenta).
  origen      text not null default 'externo'
              check (origen in ('externo', 'caja_efectivo', 'cuenta_digital')),
  source      text not null default 'manual' check (source in ('manual')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_fondo_emergencia_tenant on public.fondo_emergencia_movimientos(tenant_id);

alter table public.fondo_emergencia_movimientos enable row level security;

create policy "fondo_emergencia_all" on public.fondo_emergencia_movimientos
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create trigger fondo_emergencia_updated_at
  before update on public.fondo_emergencia_movimientos
  for each row execute function public.set_updated_at();
