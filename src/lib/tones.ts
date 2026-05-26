export type Tone = {
  /** Texto corto para la etiqueta del estado: "saludable" | "alto" | "crítico" | "—" */
  label: string
  /** Tailwind text-color: para usar en números y status text */
  text: string
  /** Tailwind bg-color: para barras de progreso y accents verticales */
  bar: string
  /** Tailwind bg-color tenue: para tintes de fondo en cards (oklch translúcido) */
  tint: string
}

const NEUTRAL: Tone = { label: '—', text: 'text-muted-foreground', bar: 'bg-muted', tint: '' }
const GOOD: Tone = { label: 'saludable', text: 'text-emerald-700', bar: 'bg-emerald-600', tint: 'bg-emerald-50/40' }
const WARN: Tone = { label: 'alto', text: 'text-amber-700', bar: 'bg-amber-500', tint: 'bg-amber-50/40' }
const CRIT: Tone = { label: 'crítico', text: 'text-rose-700', bar: 'bg-rose-500', tint: 'bg-rose-50/50' }

/** Aplica thresholds genéricos: ≤ goodMax → bueno, ≤ warnMax → warning, > warnMax → crítico. */
function bandTone(pct: number | null, goodMax: number, warnMax: number, opts?: { goodLabel?: string }): Tone {
  if (pct === null) return NEUTRAL
  if (pct <= goodMax) return opts?.goodLabel ? { ...GOOD, label: opts.goodLabel } : GOOD
  if (pct <= warnMax) return WARN
  return CRIT
}

/** Food Cost — benchmark gastronómico: ≤35% saludable, ≤40% alto, >40% crítico. */
export function foodCostTone(pct: number | null): Tone {
  if (pct !== null && pct <= 30) return { ...GOOD, label: 'óptimo' }
  return bandTone(pct, 35, 40)
}

/** Labor Cost — ≤32% saludable, ≤40% alto, >40% crítico. */
export function laborCostTone(pct: number | null): Tone {
  return bandTone(pct, 32, 40)
}

/** Prime Cost (food + labor) — ≤65% saludable, ≤75% alto, >75% crítico. */
export function primeCostTone(pct: number | null): Tone {
  return bandTone(pct, 65, 75)
}

/** Stock disponible vs. referencia: <15% crítico, <30% warning, ≥30% ok. */
export function stockTone(pct: number): Pick<Tone, 'text' | 'bar'> {
  if (pct < 15) return { text: CRIT.text, bar: CRIT.bar }
  return { text: WARN.text, bar: WARN.bar }
}

/** Saldo de IVA: negativo (a favor) verde; positivo (a pagar) rojo. */
export function ivaBalanceTone(balance: number): Tone & { isAFavor: boolean } {
  const isAFavor = balance < 0
  return {
    ...(isAFavor ? GOOD : CRIT),
    label: isAFavor ? 'a favor' : 'a pagar',
    isAFavor,
  }
}
