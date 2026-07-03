-- Asignacion "receta del dia" por dia de la semana. Cada tenant tiene un
-- producto por DOW (0=domingo, 1=lunes...). Cuando Bistrosoft trae un item
-- con nombre tipo "Sugerencia del dia", "Menu del dia", "sugerenca del dia
-- (barra)" — el matching resuelve al producto asignado al DOW del ticket, y
-- luego aplica el redirect a variante para que canal/formato terminen bien.
--
-- producto_id apunta a UNA variante (o standalone). Como el matching aplica
-- redirectToVariant despues, se puede asignar cualquier variante del concepto
-- y el sistema termina eligiendo la que corresponde por (canal, formato) del
-- ticket. Esto matchea el modelo del user: "1 concepto -> autoredirige".

create table public.receta_del_dia (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  dow         smallint not null check (dow between 0 and 6),
  producto_id uuid not null references public.productos(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, dow)
);

create index idx_receta_del_dia_tenant on public.receta_del_dia(tenant_id);

alter table public.receta_del_dia enable row level security;

create policy "receta_del_dia_all" on public.receta_del_dia
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create trigger receta_del_dia_updated_at
  before update on public.receta_del_dia
  for each row execute function public.set_updated_at();
