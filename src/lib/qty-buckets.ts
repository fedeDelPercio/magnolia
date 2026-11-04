import { formatDate } from './format'

// Agrupado temporal de compras. Lo usan las evoluciones del detalle de
// proveedor (precios, cantidad comprada, costo total) y la sección "Cantidad
// comprada" de la ficha del insumo: mismas vistas (por compra / semana / mes).

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

export type PriceBucket = {
  fecha: string
  label: string
  chartLabel?: string | undefined
  // Precio por unidad: el de la compra, o el promedio del período ponderado por
  // la cantidad comprada (una compra chica cara no pesa igual que una grande).
  precio: number
  compras: number
}

// Precio promedio por semana o mes, ponderado por cantidad. Si en el período
// no hay cantidades (> 0), promedio simple. Devuelve buckets ascendentes.
export function groupPriceByPeriod(
  entries: { fecha: string; unit_price: number; qty: number }[],
  groupBy: 'semana' | 'mes',
): PriceBucket[] {
  const map = new Map<string, { bucket: PriceBucket; monto: number; qty: number; suma: number }>()
  for (const e of entries) {
    const start = groupBy === 'semana' ? weekStartISO(e.fecha) : `${e.fecha.slice(0, 7)}-01`
    const qty = e.qty > 0 ? e.qty : 0
    const acc = map.get(start)
    if (acc) {
      acc.monto += e.unit_price * qty
      acc.qty += qty
      acc.suma += e.unit_price
      acc.bucket.compras += 1
    } else {
      map.set(start, {
        bucket: {
          fecha: start,
          label: groupBy === 'semana' ? `Semana del ${formatDate(start)}` : monthLabel(start),
          chartLabel: groupBy === 'mes' ? monthShortLabel(start) : undefined,
          precio: 0,
          compras: 1,
        },
        monto: e.unit_price * qty,
        qty,
        suma: e.unit_price,
      })
    }
  }
  return Array.from(map.values())
    .map(({ bucket, monto, qty, suma }) => ({ ...bucket, precio: qty > 0 ? monto / qty : suma / bucket.compras }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export type CostBucket = {
  fecha: string
  label: string
  chartLabel?: string | undefined
  // Lo gastado en el insumo: cantidad × precio, con descuento e IVA de la compra.
  costo: number
  qty: number
  compras: number
}

// Costo total por semana o mes: suma lo gastado y la cantidad del período.
// Devuelve buckets ascendentes.
export function groupCostByPeriod(
  entries: { fecha: string; costo: number; qty: number }[],
  groupBy: 'semana' | 'mes',
): CostBucket[] {
  const qty = groupQtyByPeriod(entries, groupBy)
  const costo = new Map(groupQtyByPeriod(entries.map((e) => ({ fecha: e.fecha, qty: e.costo })), groupBy).map((b) => [b.fecha, b.qty]))
  return qty.map((b) => ({ ...b, costo: costo.get(b.fecha) ?? 0 }))
}
