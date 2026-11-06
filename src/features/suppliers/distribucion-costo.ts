import { formatDate } from '@/lib/format'
import { periodoDe, type QtyGroupBy } from '@/lib/qty-buckets'
import { computePricing } from './pricing'

// Distribución del costo: cuánto de lo comprado a un proveedor en un período
// (una compra, una semana o un mes) se fue en cada insumo, de mayor a menor.
// Cada insumo cuenta lo gastado en él (cantidad × precio, con descuento e IVA
// de la compra). Para que las filas sumen el total de las compras (lo que
// muestra "Total proveedor"), se agregan las percepciones y, si una compra
// tiene un total mayor a la suma de sus ítems (cargas incompletas), la
// diferencia como "Sin detalle de insumos".

export type CompraParaDistribucion = {
  id: string
  fecha: string
  total: number
  percepciones: number
  iva_rate: number
  descuento_pct: number
  compra_items: { qty: number; unit_price: number; iva_rate: number | null; insumos: { name: string } }[]
}

export type FilaDistribucion = {
  nombre: string
  costo: number
  tipo: 'insumo' | 'percepciones' | 'sin_detalle'
}

export type PeriodoDistribucion = {
  key: string
  fecha: string
  label: string
  // Suma de los totales de las compras del período.
  total: number
  compras: number
  // De mayor a menor; solo montos > 0.
  filas: FilaDistribucion[]
}

export const NOMBRE_PERCEPCIONES = 'Percepciones'
export const NOMBRE_SIN_DETALLE = 'Sin detalle de insumos'

type Acumulado = {
  key: string
  fecha: string
  label: string
  total: number
  compras: number
  insumos: Map<string, number>
  percepciones: number
  sinDetalle: number
}

function sumarCompra(acc: Acumulado, c: CompraParaDistribucion) {
  const total = Number(c.total) || 0
  const percepciones = Number(c.percepciones) || 0
  const lineas = computePricing(c.compra_items, Number(c.iva_rate) || 0, Number(c.descuento_pct) || 0).lineas
  let items = 0
  c.compra_items.forEach((item, i) => {
    const costo = lineas[i]?.total ?? 0
    items += costo
    acc.insumos.set(item.insumos.name, (acc.insumos.get(item.insumos.name) ?? 0) + costo)
  })
  acc.total += total
  acc.compras += 1
  acc.percepciones += percepciones
  // Redondeos de centavos no cuentan como "sin detalle".
  const resto = total - percepciones - items
  if (resto > 1) acc.sinDetalle += resto
}

function cerrar(acc: Acumulado): PeriodoDistribucion {
  const filas: FilaDistribucion[] = [...acc.insumos].map(([nombre, costo]) => ({ nombre, costo, tipo: 'insumo' as const }))
  if (acc.percepciones > 0) filas.push({ nombre: NOMBRE_PERCEPCIONES, costo: acc.percepciones, tipo: 'percepciones' })
  if (acc.sinDetalle > 0) filas.push({ nombre: NOMBRE_SIN_DETALLE, costo: acc.sinDetalle, tipo: 'sin_detalle' })
  return {
    key: acc.key,
    fecha: acc.fecha,
    label: acc.label,
    total: acc.total,
    compras: acc.compras,
    filas: filas.filter((f) => f.costo > 0.005).sort((a, b) => b.costo - a.costo || a.nombre.localeCompare(b.nombre)),
  }
}

function nuevo(key: string, fecha: string, label: string): Acumulado {
  return { key, fecha, label, total: 0, compras: 0, insumos: new Map(), percepciones: 0, sinDetalle: 0 }
}

// Un período por compra, semana o mes; del más reciente al más viejo.
export function distribucionPorPeriodo(
  compras: CompraParaDistribucion[],
  groupBy: QtyGroupBy,
): PeriodoDistribucion[] {
  const map = new Map<string, Acumulado>()
  for (const c of compras) {
    const p = groupBy === 'compra' ? { fecha: c.fecha, label: formatDate(c.fecha) } : periodoDe(c.fecha, groupBy)
    const key = groupBy === 'compra' ? c.id : p.fecha
    let acc = map.get(key)
    if (!acc) {
      acc = nuevo(key, p.fecha, p.label)
      map.set(key, acc)
    }
    sumarCompra(acc, c)
  }
  // Compras del mismo día: quedan en el orden en que vinieron (las más nuevas primero).
  return [...map.values()].map(cerrar).sort((a, b) => b.fecha.localeCompare(a.fecha))
}

// Todas las compras juntas (la ventana de tiempo elegida).
export function distribucionDelRango(compras: CompraParaDistribucion[], label = 'Todo el período'): PeriodoDistribucion {
  const acc = nuevo('todo', compras[0]?.fecha ?? '', label)
  for (const c of compras) sumarCompra(acc, c)
  return cerrar(acc)
}
