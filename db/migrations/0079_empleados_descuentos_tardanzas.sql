-- Empleados: descuentos sobre el plus mensual y llegadas tarde.
--
-- 1) empleado_descuentos: desperdicio (u otro faltante) atribuible a un
--    empleado. Queda PENDIENTE (liquidacion_id null) hasta que se paga el
--    próximo plus mensual (con el primer día que se cierra en el mes): ahí se
--    descuenta y queda vinculado a esa liquidación. Si se borra la
--    liquidación, el descuento vuelve a pendiente.
--    Producto + cantidad son opcionales: sirven para sugerir el monto (costo
--    del producto) y para dejar registro de qué fue.
-- 2) empleado_liquidaciones.monto_descuentos: cuánto se descontó del plus en
--    ese pago. monto_plus pasa a ser el plus NETO efectivamente pagado (el
--    monto_total generado = sueldo + plus neto sigue siendo lo que sale de caja).
-- 3) empleado_tardanzas: llegadas tarde (minutos que el empleado queda
--    debiendo) con marca de recuperado.

create table if not exists public.empleado_descuentos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fecha date not null default current_date,
  motivo text not null check (length(trim(motivo)) > 0),
  producto_id uuid references public.productos(id) on delete set null,
  cantidad numeric(10,3) check (cantidad is null or cantidad > 0),
  monto numeric(12,2) not null check (monto > 0),
  liquidacion_id uuid references public.empleado_liquidaciones(id) on delete set null,
  -- Si los descuentos pendientes superan el plus, lo que no entró se arrastra
  -- al mes siguiente como un descuento nuevo que apunta a la liquidación que lo
  -- generó. Si esa liquidación se borra, los originales vuelven a pendiente
  -- (on delete set null de arriba) y el arrastre desaparece (cascade): sin
  -- descontar dos veces.
  origen_liquidacion_id uuid references public.empleado_liquidaciones(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_empleado_descuentos_empleado
  on public.empleado_descuentos (empleado_id, fecha desc);
create index if not exists idx_empleado_descuentos_pendientes
  on public.empleado_descuentos (empleado_id) where liquidacion_id is null;
create index if not exists idx_empleado_descuentos_liquidacion
  on public.empleado_descuentos (liquidacion_id) where liquidacion_id is not null;

alter table public.empleado_descuentos enable row level security;
drop policy if exists empleado_descuentos_all on public.empleado_descuentos;
create policy empleado_descuentos_all on public.empleado_descuentos
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

alter table public.empleado_liquidaciones
  add column if not exists monto_descuentos numeric(12,2) not null default 0
    check (monto_descuentos >= 0);

create table if not exists public.empleado_tardanzas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  empleado_id uuid not null references public.empleados(id) on delete cascade,
  fecha date not null default current_date,
  minutos integer not null check (minutos > 0 and minutos <= 720),
  notas text,
  recuperada boolean not null default false,
  recuperada_at date,
  created_at timestamptz not null default now()
);

create index if not exists idx_empleado_tardanzas_empleado
  on public.empleado_tardanzas (empleado_id, fecha desc);
create index if not exists idx_empleado_tardanzas_tenant_fecha
  on public.empleado_tardanzas (tenant_id, fecha desc);

alter table public.empleado_tardanzas enable row level security;
drop policy if exists empleado_tardanzas_all on public.empleado_tardanzas;
create policy empleado_tardanzas_all on public.empleado_tardanzas
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));
