// Espejo de la funcion normalize_qty(qty, from_unit, to_unit) en Postgres.
// Convierte una cantidad entre unidades compatibles (kg<->g, l<->ml). Si las
// unidades no son convertibles entre si (ej. 'u' vs 'kg') devuelve la qty
// original — mismo comportamiento que el SQL para no introducir divergencia.
export function normalizeQty(qty: number, from: string, to: string): number {
  if (from === to) return qty
  if (from === 'kg' && to === 'g') return qty * 1000
  if (from === 'g' && to === 'kg') return qty / 1000
  if (from === 'l' && to === 'ml') return qty * 1000
  if (from === 'ml' && to === 'l') return qty / 1000
  return qty
}
