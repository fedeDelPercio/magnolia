export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year!, month! - 1, day!).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`
}

/** Separa la parte entera de los decimales para fadear los centavos en
 * tipografía editorial. `"$ 1.418.488,00"` → `{ whole: "$ 1.418.488", decimals: ",00" }` */
export function splitCurrency(value: number): { whole: string; decimals: string } {
  const formatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
  const lastComma = formatted.lastIndexOf(',')
  if (lastComma === -1) return { whole: formatted, decimals: '' }
  return { whole: formatted.slice(0, lastComma), decimals: formatted.slice(lastComma) }
}

/** Notación compacta con prefijo $: 1_500_000 → "$1.5M" */
export function compactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`
  return `$${Math.round(value)}`
}

/** Notación compacta sin prefijo: 1_500_000 → "1.5M" */
export function compactNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1_000) return `${Math.round(value / 1_000)}k`
  return `${Math.round(value)}`
}

const UNIT_LABELS: Record<string, string> = { kg: 'kg', g: 'g', l: 'l', ml: 'ml', u: 'u' }

/** Auto-escala g→kg y ml→l cuando |val| ≥ 1000. */
export function formatQuantity(val: number, unit: string): string {
  if ((unit === 'g' || unit === 'kg') && Math.abs(val) >= 1000) {
    return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg`
  }
  if ((unit === 'ml' || unit === 'l') && Math.abs(val) >= 1000) {
    return `${(val / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} l`
  }
  return `${val.toLocaleString('es-AR', { maximumFractionDigits: 1 })} ${UNIT_LABELS[unit] ?? unit}`
}
