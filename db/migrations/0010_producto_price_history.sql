CREATE TABLE public.producto_price_history (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id   uuid          NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  tenant_id     uuid          NOT NULL REFERENCES public.tenants(id),
  sale_price    numeric(14,2) NOT NULL,
  total_cost    numeric(14,4),
  margin_pct    numeric(5,2),
  valid_from    timestamptz   NOT NULL DEFAULT now(),
  created_by    uuid          REFERENCES auth.users(id)
);

CREATE INDEX idx_producto_price_history_producto
  ON public.producto_price_history(producto_id, valid_from DESC);

CREATE INDEX idx_producto_price_history_tenant
  ON public.producto_price_history(tenant_id);

ALTER TABLE public.producto_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "precio_historia_select" ON public.producto_price_history
  FOR SELECT USING (tenant_id IN (SELECT current_tenant_ids()));

CREATE POLICY "precio_historia_insert" ON public.producto_price_history
  FOR INSERT WITH CHECK (tenant_id IN (SELECT current_tenant_ids()));
