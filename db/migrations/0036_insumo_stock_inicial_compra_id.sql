-- Trazabilidad de qué compra activó el tracking de stock para un insumo.
-- Permite revertir track_stock + stock_inicial cuando esa compra se elimina,
-- evitando "stock fantasma" tras borrar la compra que lo había seteado.
alter table public.insumos
  add column if not exists stock_inicial_compra_id uuid
  references public.compras(id) on delete set null;

create index if not exists idx_insumos_stock_inicial_compra
  on public.insumos(stock_inicial_compra_id)
  where stock_inicial_compra_id is not null;
