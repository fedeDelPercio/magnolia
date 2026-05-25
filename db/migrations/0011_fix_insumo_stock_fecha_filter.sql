-- Fix: consumo del mismo día que el ajuste no se descontaba
-- d.fecha > la.since::date era estrictamente mayor, excluía el día del ajuste.
-- Cambio a >= para incluir consumo del día en que se registró el ajuste.
CREATE OR REPLACE VIEW public.insumo_stock AS
WITH last_ajuste AS (
  SELECT DISTINCT ON (insumo_id)
    insumo_id, stock_real AS baseline, created_at AS since
  FROM insumo_stock_ajustes
  ORDER BY insumo_id, created_at DESC
),
comprado AS (
  SELECT ci.insumo_id,
    sum(normalize_qty(ci.qty, ci.unit::text, i1.unit::text)) AS qty
  FROM compra_items ci
  JOIN insumos i1 ON i1.id = ci.insumo_id
  LEFT JOIN last_ajuste la ON la.insumo_id = ci.insumo_id
  WHERE la.since IS NULL OR ci.created_at > la.since
  GROUP BY ci.insumo_id
),
consumido AS (
  SELECT ri.insumo_id,
    sum((md.produccion / NULLIF(r.yield_qty, 0::numeric))
      * normalize_qty(ri.qty, ri.unit::text, i1.unit::text)) AS qty
  FROM movimientos_diarios md
  JOIN productos p ON p.id = md.producto_id
  JOIN recetas r ON r.id = p.receta_id
  JOIN receta_ingredientes ri ON ri.receta_id = r.id AND ri.kind = 'insumo'::ingrediente_kind
  JOIN insumos i1 ON i1.id = ri.insumo_id
  JOIN dias_operativos d ON d.id = md.dia_id
  LEFT JOIN last_ajuste la ON la.insumo_id = ri.insumo_id
  WHERE md.produccion > 0::numeric
    AND (la.since IS NULL OR d.fecha >= la.since::date)
  GROUP BY ri.insumo_id
)
SELECT
  i.id AS insumo_id,
  i.tenant_id,
  i.unit::text AS unit,
  COALESCE(la.baseline, i.stock_inicial) + COALESCE(c.qty, 0::numeric) AS stock_referencia,
  COALESCE(cons.qty, 0::numeric) AS stock_consumido,
  COALESCE(la.baseline, i.stock_inicial) + COALESCE(c.qty, 0::numeric)
    - COALESCE(cons.qty, 0::numeric) AS stock_actual
FROM insumos i
LEFT JOIN last_ajuste la ON la.insumo_id = i.id
LEFT JOIN comprado c ON c.insumo_id = i.id
LEFT JOIN consumido cons ON cons.insumo_id = i.id
WHERE i.track_stock = true;
