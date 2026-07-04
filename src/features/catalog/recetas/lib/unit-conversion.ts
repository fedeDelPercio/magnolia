// Espejo de la logica de conversion de recipe_cost() en Postgres. Cubre las
// mismas familias: peso (kg<->g), volumen (l<->ml) y cantidad (u<->docena).
// Si las unidades no son de la misma familia (ej. 'g' vs 'porcion'), devuelve
// la qty original — mismo comportamiento que el SQL para no divergir. Esto
// significa que un mismatch de familias NO se detecta automaticamente; usar
// unitsCompatible() para chequear antes.
export function normalizeQty(qty: number, from: string, to: string): number {
  if (from === to) return qty
  if (from === 'kg' && to === 'g') return qty * 1000
  if (from === 'g' && to === 'kg') return qty / 1000
  if (from === 'l' && to === 'ml') return qty * 1000
  if (from === 'ml' && to === 'l') return qty / 1000
  if (from === 'u' && to === 'docena') return qty / 12
  if (from === 'docena' && to === 'u') return qty * 12
  return qty
}

// Devuelve true si las dos unidades pertenecen a la misma familia (peso,
// volumen o cantidad). Sirve para detectar mismatches — cuando normalizeQty
// no puede convertir (ej. 'g' y 'porcion'), el costo calculado es ruido.
const WEIGHT = new Set(['kg', 'g'])
const VOLUME = new Set(['l', 'ml'])
const COUNT = new Set(['u', 'docena'])
export function unitsCompatible(a: string, b: string): boolean {
  if (a === b) return true
  if (WEIGHT.has(a) && WEIGHT.has(b)) return true
  if (VOLUME.has(a) && VOLUME.has(b)) return true
  if (COUNT.has(a) && COUNT.has(b)) return true
  return false
}
