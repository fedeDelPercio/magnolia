-- Migration 0009: stock adjustment / physical count feature
-- Adds insumo_stock_ajustes table and updates insumo_stock view
-- to use the latest adjustment as the new baseline for stock calculations.

-- ─── Table ─────────────────────────────────────────────────────────────────

CREATE TABLE insumo_stock_ajustes (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  insumo_id     uuid          NOT NULL REFERENCES insumos(id) ON DELETE CASCADE,
  tenant_id     uuid          NOT NULL REFERENCES tenants(id),
  stock_teorico numeric(14,4) NOT NULL,
  stock_real    numeric(14,4) NOT NULL,
  diferencia    numeric(14,4) GENERATED ALWAYS AS (stock_real - stock_teorico) STORED,
  notas         text,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  created_by    uuid          REFERENCES auth.users(id)
);

CREATE INDEX idx_stock_ajustes_insumo  ON insumo_stock_ajustes(insumo_id, created_at DESC);
CREATE INDEX idx_stock_ajustes_tenant  ON insumo_stock_ajustes(tenant_id);

ALTER TABLE insumo_stock_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_ajustes_select" ON insumo_stock_ajustes
  FOR SELECT USING (tenant_id IN (SELECT current_tenant_ids()));

CREATE POLICY "stock_ajustes_insert" ON insumo_stock_ajustes
  FOR INSERT WITH CHECK (tenant_id IN (SELECT current_tenant_ids()));

-- ─── View (replace) ────────────────────────────────────────────────────────
-- Original formula:
--   stock_referencia = stock_inicial + all_comprado
--   stock_actual     = stock_referencia - all_consumido
--
-- New formula:
--   baseline = stock_real of the latest adjustment (or stock_inicial if none)
--   Only count compra_items and production AFTER the latest adjustment.
--   stock_referencia = baseline + comprado_after_adjustment
--   stock_actual     = stock_referencia - consumido_after_adjustment

CREATE OR REPLACE VIEW public.insumo_stock AS
WITH last_ajuste AS (
  -- Latest stock adjustment per insumo (index: insumo_id, created_at DESC)
  SELECT DISTINCT ON (insumo_id)
    insumo_id,
    stock_real  AS baseline,
    created_at  AS since
  FROM insumo_stock_ajustes
  ORDER BY insumo_id, created_at DESC
),
comprado AS (
  -- Purchases after the latest adjustment (or all if no adjustment)
  -- compra_items.created_at is timestamptz — compare directly against la.since
  SELECT
    ci.insumo_id,
    sum(normalize_qty(ci.qty, ci.unit::text, i1.unit::text)) AS qty
  FROM compra_items ci
  JOIN insumos i1 ON i1.id = ci.insumo_id
  LEFT JOIN last_ajuste la ON la.insumo_id = ci.insumo_id
  WHERE la.since IS NULL OR ci.created_at > la.since
  GROUP BY ci.insumo_id
),
consumido AS (
  -- Production-based consumption after the latest adjustment.
  -- dias_operativos.fecha is a date; cast la.since to date for comparison.
  SELECT
    ri.insumo_id,
    sum(
      (md.produccion / NULLIF(r.yield_qty, 0::numeric))
      * normalize_qty(ri.qty, ri.unit::text, i1.unit::text)
    ) AS qty
  FROM movimientos_diarios md
  JOIN productos              p  ON p.id  = md.producto_id
  JOIN recetas                r  ON r.id  = p.receta_id
  JOIN receta_ingredientes    ri ON ri.receta_id = r.id AND ri.kind = 'insumo'::ingrediente_kind
  JOIN insumos                i1 ON i1.id = ri.insumo_id
  JOIN dias_operativos        d  ON d.id  = md.dia_id
  LEFT JOIN last_ajuste       la ON la.insumo_id = ri.insumo_id
  WHERE md.produccion > 0::numeric
    AND (la.since IS NULL OR d.fecha > la.since::date)
  GROUP BY ri.insumo_id
)
SELECT
  i.id        AS insumo_id,
  i.tenant_id,
  i.unit::text AS unit,
  -- referencia: baseline + what was bought since last adjustment
  COALESCE(la.baseline, i.stock_inicial) + COALESCE(c.qty, 0::numeric)   AS stock_referencia,
  -- consumido: how much was used since last adjustment
  COALESCE(cons.qty, 0::numeric)                                           AS stock_consumido,
  -- actual: what's left
  COALESCE(la.baseline, i.stock_inicial) + COALESCE(c.qty, 0::numeric)
    - COALESCE(cons.qty, 0::numeric)                                       AS stock_actual
FROM insumos i
LEFT JOIN last_ajuste la   ON la.insumo_id  = i.id
LEFT JOIN comprado    c    ON c.insumo_id   = i.id
LEFT JOIN consumido   cons ON cons.insumo_id = i.id
WHERE i.track_stock = true;
