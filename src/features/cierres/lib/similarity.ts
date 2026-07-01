// Utilities para sugerir productos del catalogo Magnolia que se parezcan a un
// nombre que devuelve Bistrosoft y no matcheo automatico. Se usa client-side
// en la UI de mapeo de cierres.
//
// La normalizacion espeja la de sync.ts para que la sugerencia refleje las
// mismas heuristicas que aplica el matcher del sync (plural/singular,
// abreviaciones, tildes, mayusculas).

export function normalizeName(s: string): string {
  const base = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
  const expanded = base
    .replace(/\bqui\./g, 'quiche')
    .replace(/\bemp\./g, 'empanada')
    .replace(/\bmed\./g, 'medialuna')
  return expanded
    .split(' ')
    .map((w) => (w.length > 2 && w.endsWith('s') ? w.slice(0, -1) : w))
    .join(' ')
}

function bigrams(s: string): Set<string> {
  const set = new Set<string>()
  const clean = s.replace(/\s+/g, '')
  for (let i = 0; i < clean.length - 1; i++) set.add(clean.slice(i, i + 2))
  return set
}

// Sorensen-Dice sobre bigramas de caracteres. 0..1. Mas robusto que Levenshtein
// para nombres cortos con typos, y no requiere dependencia externa.
export function similarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (na === nb) return 1
  if (na.length < 2 || nb.length < 2) return 0
  const A = bigrams(na)
  const B = bigrams(nb)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  return (2 * inter) / (A.size + B.size)
}

// Devuelve el mejor match del listado o null si nadie supera el umbral.
// excludeId permite descartar el ya asignado (por si el user quiere reasignar).
export function topSuggestion(
  nombre: string,
  options: { value: string; label: string }[],
  excludeId: string | null = null,
  threshold = 0.3,
): { value: string; label: string; score: number } | null {
  let best: { value: string; label: string; score: number } | null = null
  for (const o of options) {
    if (o.value === excludeId) continue
    const s = similarity(nombre, o.label)
    if (s >= threshold && (best === null || s > best.score)) {
      best = { value: o.value, label: o.label, score: s }
    }
  }
  return best
}
