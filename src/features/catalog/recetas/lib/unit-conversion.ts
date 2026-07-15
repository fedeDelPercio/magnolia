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
const WEIGHT = ['kg', 'g'] as const
const VOLUME = ['l', 'ml'] as const
const COUNT = ['u', 'docena'] as const
const WEIGHT_SET = new Set<string>(WEIGHT)
const VOLUME_SET = new Set<string>(VOLUME)
const COUNT_SET = new Set<string>(COUNT)
export function unitsCompatible(a: string, b: string): boolean {
  if (a === b) return true
  if (WEIGHT_SET.has(a) && WEIGHT_SET.has(b)) return true
  if (VOLUME_SET.has(a) && VOLUME_SET.has(b)) return true
  if (COUNT_SET.has(a) && COUNT_SET.has(b)) return true
  return false
}

// Dada la unidad del insumo/sub-receta, devuelve las unidades que el user
// puede elegir para "cuanto consumo". Ej: si el insumo es kg → [kg, g]; si es
// u → [u, docena]; si es porcion → [porcion]. Sirve para no dejar mezclar
// familias en el editor y evitar el bug tipico de cargar "1 u" cuando el
// insumo esta en kg (que hace que el costo salga mal).
export function compatibleUnitsFor(target: string): string[] {
  if (WEIGHT_SET.has(target)) return [...WEIGHT]
  if (VOLUME_SET.has(target)) return [...VOLUME]
  if (COUNT_SET.has(target)) return [...COUNT]
  return [target]
}
