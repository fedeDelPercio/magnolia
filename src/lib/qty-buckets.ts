import { formatDate } from './format'

// Agrupado temporal de cantidades compradas. Lo usan el módulo "Evolución de
// cantidad comprada" del detalle de proveedor y la sección "Cantidad comprada"
// de la ficha del insumo: mismas vistas (por compra / semana / mes), misma
// semántica de suma.

export type QtyGroupBy = 'compra' | 'semana' | 'mes'

export const QTY_GROUP_LABELS: Record<QtyGroupBy, string> = {
  compra: 'Por compra',
  semana: 'Por semana',
  mes: 'Por mes',
}

export type QtyBucket = {
  // Fecha representativa (lunes de la semana / 1° del mes) — ordena y va al eje X.
  fecha: string
  label: string
  // Etiqueta corta para el eje X del chart (solo mensual; el resto usa la fecha).
  chartLabel?: string | undefined
  qty: number
  compras: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// Lunes de la semana de la fecha dada (semana lunes-a-domingo).
function weekStartISO(fecha: string): string {
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number)
  const date = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function monthLabel(startISO: string): string {
  const [y, m] = startISO.split('-').map(Number)
  const s = new Date(y ?? 1970, (m ?? 1) - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function monthShortLabel(startISO: string): string {
  const [y, m] = startISO.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' })
}

// Suma cantidades por semana o mes. Acepta entradas en cualquier orden;
// devuelve buckets ascendentes por fecha.
export function groupQtyByPeriod(
  entries: { fecha: string; qty: number }[],
  groupBy: 'semana' | 'mes',
): QtyBucket[] {
  const map = new Map<string, QtyBucket>()
  for (const e of entries) {
    const start = groupBy === 'semana' ? weekStartISO(e.fecha) : `${e.fecha.slice(0, 7)}-01`
    const existing = map.get(start)
    if (existing) {
      existing.qty += e.qty
      existing.compras += 1
    } else {
      map.set(start, {
        fecha: start,
        label: groupBy === 'semana' ? `Semana del ${formatDate(start)}` : monthLabel(start),
        chartLabel: groupBy === 'mes' ? monthShortLabel(start) : undefined,
        qty: e.qty,
        compras: 1,
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
}
