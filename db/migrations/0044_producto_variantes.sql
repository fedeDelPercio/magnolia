-- Variantes de producto por canal (SALON vs DELIVERY) y formato (individual vs menu).
--
-- Modelo:
-- - producto_conceptos: agrupador. "Quiche Calabaza" es un concepto; sus 4
--   variantes son productos separados con el mismo concepto_id.
-- - productos gana concepto_id + canal + formato. Cada variante es un row propio
--   con su receta y precio.
-- - cierre_caja_productos gana canal + formato: la senal viene de la API
--   (origin del ticket) o del PDF (categoria), y del prefijo del nombre ("Menu X").
--
-- Backwards compat: todas las columnas nuevas son nullable. Productos existentes
-- quedan con concepto_id=null (=standalone, se comportan como hoy). Recien
-- cuando Caro cree variantes empiezan a agruparse.

create type public.producto_canal as enum ('salon', 'delivery');
create type public.producto_formato as enum ('individual', 'menu');

-- ---------- producto_conceptos ----------

create table public.producto_conceptos (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_conceptos_tenant on public.producto_conceptos(tenant_id);
create unique index idx_conceptos_tenant_name
  on public.producto_conceptos(tenant_id, lower(name));

alter table public.producto_conceptos enable row level security;

create policy "producto_conceptos_all" on public.producto_conceptos
  for all
  using (tenant_id in (select public.current_tenant_ids()))
  with check (tenant_id in (select public.current_tenant_ids()));

create trigger conceptos_updated_at
  before update on public.producto_conceptos
  for each row execute function public.set_updated_at();

-- ---------- productos: concepto_id + canal + formato ----------

alter table public.productos
  add column concepto_id uuid references public.producto_conceptos(id) on delete set null,
  add column canal   public.producto_canal,
  add column formato public.producto_formato;

create index idx_productos_concepto
  on public.productos(concepto_id) where concepto_id is not null;

-- Una sola variante por combinacion (concepto, canal, formato). Se aplica solo
-- cuando concepto_id no es null — productos standalone pueden coexistir libremente.
-- NULLS NOT DISTINCT (PG15+) trata NULL como igual a NULL: dos variantes con
-- (concepto=X, canal=NULL, formato=NULL) chocan, que es lo que queremos.
create unique index idx_productos_variante_unica
  on public.productos(concepto_id, canal, formato)
  nulls not distinct
  where concepto_id is not null;

-- ---------- cierre_caja_productos: canal + formato ----------

alter table public.cierre_caja_productos
  add column canal   public.producto_canal,
  add column formato public.producto_formato;

-- Backfill retroactivo del formato usando el prefijo del nombre — todos los items
-- existentes cuyo nombre empieza con "Menu " o "Menú " son formato menu. El resto
-- queda en null (=indeterminado, no asumimos individual porque puede ser una
-- bebida o algo que no tiene formato).
update public.cierre_caja_productos
   set formato = 'menu'::public.producto_formato
 where formato is null
   and (
     nombre ilike 'menú %'
     or nombre ilike 'menu %'
   );

-- El canal historico lo backfilleamos en el sync (se re-procesan cierres) porque
-- para hacerlo aqui necesitariamos joinear contra bistro_transacciones y ese
-- vinculo no esta materializado en cierre_caja_productos.
