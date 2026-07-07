import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

/* ---------- helpers ---------- */

/** Período anterior de igual duración (para deltas y comparaciones mes/mes). */
function prevPeriod(from: string, to: string): { from: string; to: string } {
  const fromD = new Date(from)
  const toD = new Date(to)
  const ms = toD.getTime() - fromD.getTime()
  const prevTo = new Date(fromD.getTime())
  const prevFrom = new Date(fromD.getTime() - ms)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: iso(prevFrom), to: iso(prevTo) }
}

/* ---------- types ---------- */

export type DashboardOverview = {
  facturacion: number
  facturacionPrev: number
  facturacionDeltaPct: number | null
  cubiertosSalon: number
  ticketPromedioSalon: number
  cantidadVentas: number
  ticketPromedio: number
  foodCostPct: number | null
  foodCostMonto: number
  laborCostPct: number | null
  laborCostMonto: number
  primeCostPct: number | null
  margenPonderadoPct: number | null
  egresosTotales: number
  resultadoCaja: number
  resultadoCajaPct: number | null
  margenOperativo: number | null
  margenOperativoPct: number | null
}

export type DailyVentas = {
  fecha: string
  total: number
  salon: number
  mostrador: number
}

export type MixData = {
  salon: number
  mostrador: number
  cubiertosSalon: number
  transaccionesMostrador: number
}

export type MediosPago = {
  efectivo: number
  tarjetas: number
  qr: number
  online: number
}

export type TopProducto = {
  nombre: string
  cantidad: number
  monto: number
}

export type ProductoRiesgo = {
  id: string
  name: string
  sale_price: number
  total_cost: number
  margin_pct: number
  target_margin_pct: number
  deficit_pct: number
}

export type ProductoRentable = {
  id: string
  name: string
  cantidad: number
  margen_unitario: number
  margen_total: number
  margin_pct: number
}

export type InsumoCritico = {
  id: string
  name: string
  unit: string
  stock_actual: number
  stock_referencia: number
  pct: number
}

/* ---------- queries ---------- */

export async function getDashboardOverview(from: string, to: string): Promise<DashboardOverview> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { from: prevFrom, to: prevTo } = prevPeriod(from, to)

  const [cierresRes, cierresPrevRes, productosRes, sueldosRes] = await Promise.all([
    supabase
      .from('cierres_caja_active')
      .select('total_vendido, monto_salon, cubiertos, cantidad_ventas')
      .eq('tenant_id', tenantId)
      .gte('fecha_cierre_local', from)
      .lt('fecha_cierre_local', to),
    supabase
      .from('cierres_caja_active')
      .select('total_vendido')
      .eq('tenant_id', tenantId)
      .gte('fecha_cierre_local', prevFrom)
      .lt('fecha_cierre_local', prevTo),
    supabase
      .from('cierre_caja_productos_active')
      .select('cantidad, monto_total, producto_id')
      .eq('cierre_tenant_id', tenantId)
      .gte('cierre_fecha_local', from)
      .lt('cierre_fecha_local', to),
    supabase
      .from('caja_movimientos')
      .select('monto, categoria')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'egreso')
      .gte('fecha', from)
      .lt('fecha', to),
  ])

  if (cierresRes.error) throw new Error(cierresRes.error.message)
  if (cierresPrevRes.error) throw new Error(cierresPrevRes.error.message)
  if (productosRes.error) throw new Error(productosRes.error.message)
  if (sueldosRes.error) throw new Error(sueldosRes.error.message)

  const facturacion = (cierresRes.data ?? []).reduce((s, c) => s + (Number(c.total_vendido) || 0), 0)
  const facturacionPrev = (cierresPrevRes.data ?? []).reduce(
    (s, c) => s + (Number(c.total_vendido) || 0),
    0,
  )
  const facturacionDeltaPct =
    facturacionPrev > 0 ? ((facturacion - facturacionPrev) / facturacionPrev) * 100 : null

  const montoSalon = (cierresRes.data ?? []).reduce((s, c) => s + (Number(c.monto_salon) || 0), 0)
  const cubiertosSalon = (cierresRes.data ?? []).reduce((s, c) => s + (Number(c.cubiertos) || 0), 0)
  const ticketPromedioSalon = cubiertosSalon > 0 ? montoSalon / cubiertosSalon : 0
  const cantidadVentas = (cierresRes.data ?? []).reduce(
    (s, c) => s + (Number(c.cantidad_ventas) || 0),
    0,
  )
  const ticketPromedio = cantidadVentas > 0 ? facturacion / cantidadVentas : 0

  // Food cost: necesita join con product_costs
  const productosIds = Array.from(
    new Set((productosRes.data ?? []).map((p) => p.producto_id).filter((id): id is string => !!id)),
  )

  let foodCostMonto = 0
  let ventasMatcheadas = 0
  let costosPorProducto: Map<string, number> = new Map()

  if (productosIds.length > 0) {
    const { data: costsData } = await supabase
      .from('product_costs')
      .select('id, total_cost')
      .in('id', productosIds)
    for (const c of costsData ?? []) {
      if (c.id) costosPorProducto.set(c.id, Number(c.total_cost) || 0)
    }

    for (const row of productosRes.data ?? []) {
      if (!row.producto_id) continue
      const cost = costosPorProducto.get(row.producto_id) ?? 0
      foodCostMonto += cost * (Number(row.cantidad) || 0)
      ventasMatcheadas += Number(row.monto_total) || 0
    }
  }

  const foodCostPct = ventasMatcheadas > 0 ? (foodCostMonto / ventasMatcheadas) * 100 : null
  const margenPonderadoPct = foodCostPct !== null ? 100 - foodCostPct : null

  // Egresos totales del período (todos los movimientos de caja tipo egreso)
  const egresosTotales = (sueldosRes.data ?? []).reduce((s, m) => s + (Number(m.monto) || 0), 0)

  // Labor cost: todo lo clasificado como "Pago a empleados". La categoria
  // llega por 3 caminos: sync Bistrosoft (auto-detecta "PAGO A PROVEEDORES -
  // sueldos"), egreso digital cargado con esa cat, o egreso caja mayor
  // cargado con esa cat.
  const laborCostMonto = (sueldosRes.data ?? [])
    .filter((m) => m.categoria === 'Pago a empleados')
    .reduce((s, m) => s + (Number(m.monto) || 0), 0)
  const laborCostPct = facturacion > 0 ? (laborCostMonto / facturacion) * 100 : null
  const primeCostPct =
    foodCostPct !== null && laborCostPct !== null ? foodCostPct + laborCostPct : null

  // Resultado de caja: lo que entró menos todo lo que salió (cash real).
  const resultadoCaja = facturacion - egresosTotales
  const resultadoCajaPct = facturacion > 0 ? (resultadoCaja / facturacion) * 100 : null

  // Margen operativo: facturación menos prime cost (food + labor). Rentabilidad
  // de la operación, sin gastos fijos ni timing de compras. Solo cuando hay
  // food cost calculable (productos con receta).
  const margenOperativo =
    foodCostMonto > 0 || laborCostMonto > 0 ? facturacion - foodCostMonto - laborCostMonto : null
  const margenOperativoPct =
    margenOperativo !== null && facturacion > 0 ? (margenOperativo / facturacion) * 100 : null

  return {
    facturacion,
    facturacionPrev,
    facturacionDeltaPct,
    cubiertosSalon,
    ticketPromedioSalon,
    cantidadVentas,
    ticketPromedio,
    foodCostPct,
    foodCostMonto,
    laborCostPct,
    laborCostMonto,
    primeCostPct,
    margenPonderadoPct,
    egresosTotales,
    resultadoCaja,
    resultadoCajaPct,
    margenOperativo,
    margenOperativoPct,
  }
}

export type Granularity = 'dia' | 'semana' | 'mes'

export type EvolucionPunto = {
  period: string         // ISO date inicio del bin (yyyy-mm-dd)
  label: string          // label legible (ej: "12-may" o "Sem 19" o "May 26")
  efectivo: number
  digital: number
  total: number
}

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0 = domingo
  const diff = day === 0 ? 6 : day - 1 // ajustamos para que arranque lunes
  const r = new Date(d)
  r.setDate(d.getDate() - diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function binStart(date: Date, gran: Granularity): Date {
  if (gran === 'dia') {
    const r = new Date(date)
    r.setHours(0, 0, 0, 0)
    return r
  }
  if (gran === 'semana') return startOfWeek(date)
  return startOfMonth(date)
}

function nextBin(d: Date, gran: Granularity): Date {
  const r = new Date(d)
  if (gran === 'dia') r.setDate(d.getDate() + 1)
  else if (gran === 'semana') r.setDate(d.getDate() + 7)
  else r.setMonth(d.getMonth() + 1)
  return r
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function binLabel(d: Date, gran: Granularity): string {
  if (gran === 'dia') return `${d.getDate()}-${MES_CORTO[d.getMonth()]}`
  if (gran === 'semana') {
    // ISO week number
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const dayNum = tmp.getUTCDay() || 7
    tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1))
    const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
    return `S${week}`
  }
  return `${MES_CORTO[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`
}

export async function getFacturacionEvolution(
  from: string,
  to: string,
  gran: Granularity,
): Promise<EvolucionPunto[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('cierres_caja_active')
    .select(
      'fecha_cierre_local, monto_efectivo, monto_tarjetas, monto_qr, monto_online, monto_cuenta_cliente',
    )
    .eq('tenant_id', tenantId)
    .gte('fecha_cierre_local', from)
    .lt('fecha_cierre_local', to)

  if (error) throw new Error(error.message)

  // Agregar por bin
  const bins = new Map<string, EvolucionPunto>()
  for (const c of data ?? []) {
    if (!c.fecha_cierre_local) continue
    // Parsear como local (no UTC) — sino "2026-06-10" se interpreta como
    // 21:00 del 9 en Argentina y los cierres salen movidos un dia.
    const [y, m, dd] = c.fecha_cierre_local.split('-').map(Number)
    const d = new Date(y!, m! - 1, dd!)
    const start = binStart(d, gran)
    const key = isoDate(start)
    const efectivo = Number(c.monto_efectivo) || 0
    const digital =
      (Number(c.monto_tarjetas) || 0) +
      (Number(c.monto_qr) || 0) +
      (Number(c.monto_online) || 0) +
      (Number(c.monto_cuenta_cliente) || 0)
    const cur = bins.get(key) ?? {
      period: key,
      label: binLabel(start, gran),
      efectivo: 0,
      digital: 0,
      total: 0,
    }
    cur.efectivo += efectivo
    cur.digital += digital
    cur.total += efectivo + digital
    bins.set(key, cur)
  }

  // Rellenar los bins vacíos para mantener la continuidad temporal.
  // Parsear from/to como local (no UTC) — sino "2026-05-01" se interpreta
  // como 30/abr 21:00 en Argentina y el primer bin sale corrido un mes.
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  const fromDate = binStart(new Date(fy!, fm! - 1, fd!), gran)
  const toDate = new Date(ty!, tm! - 1, td!)
  const result: EvolucionPunto[] = []
  for (let d = fromDate; d < toDate; d = nextBin(d, gran)) {
    const key = isoDate(d)
    result.push(
      bins.get(key) ?? {
        period: key,
        label: binLabel(d, gran),
        efectivo: 0,
        digital: 0,
        total: 0,
      },
    )
  }

  // Trim leading/trailing bins vacíos. Los del medio se mantienen porque ahí
  // sí aporta información ("no operamos en ese mes"). Pero arrastrar meses
  // futuros o anteriores al primer dato es ruido visual.
  let start = 0
  while (start < result.length && result[start]!.total === 0) start++
  let end = result.length
  while (end > start && result[end - 1]!.total === 0) end--
  return result.slice(start, end)
}

export async function getDailyVentas(from: string, to: string): Promise<DailyVentas[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('cierres_caja_active')
    .select('fecha_cierre_local, total_vendido, monto_salon, monto_mostrador')
    .eq('tenant_id', tenantId)
    .gte('fecha_cierre_local', from)
    .lt('fecha_cierre_local', to)
    .order('fecha_cierre_local')

  if (error) throw new Error(error.message)

  // Agrupar por día (puede haber más de 1 cierre por día)
  const byDay = new Map<string, DailyVentas>()
  for (const c of data ?? []) {
    if (!c.fecha_cierre_local) continue
    const fecha = c.fecha_cierre_local
    const cur = byDay.get(fecha) ?? { fecha, total: 0, salon: 0, mostrador: 0 }
    cur.total += Number(c.total_vendido) || 0
    cur.salon += Number(c.monto_salon) || 0
    cur.mostrador += Number(c.monto_mostrador) || 0
    byDay.set(fecha, cur)
  }

  return Array.from(byDay.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export async function getMixData(from: string, to: string): Promise<MixData> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const [cierresRes, productosRes] = await Promise.all([
    supabase
      .from('cierres_caja_active')
      .select('id, monto_salon, monto_mostrador, cubiertos')
      .eq('tenant_id', tenantId)
      .gte('fecha_cierre_local', from)
      .lt('fecha_cierre_local', to),
    supabase
      .from('cierre_caja_productos_active')
      .select('categoria, cierre_caja_id')
      .eq('cierre_tenant_id', tenantId)
      .gte('cierre_fecha_local', from)
      .lt('cierre_fecha_local', to),
  ])

  if (cierresRes.error) throw new Error(cierresRes.error.message)
  if (productosRes.error) throw new Error(productosRes.error.message)

  const salon = (cierresRes.data ?? []).reduce((s, c) => s + (Number(c.monto_salon) || 0), 0)
  const mostrador = (cierresRes.data ?? []).reduce(
    (s, c) => s + (Number(c.monto_mostrador) || 0),
    0,
  )
  const cubiertosSalon = (cierresRes.data ?? []).reduce((s, c) => s + (Number(c.cubiertos) || 0), 0)

  // Transacciones de mostrador: cantidad de cierres distintos que tienen al menos un producto DELIVERY*
  const cierresConMostrador = new Set(
    (productosRes.data ?? [])
      .filter((p) => (p.categoria ?? '').toUpperCase().includes('DELIVERY'))
      .map((p) => p.cierre_caja_id),
  )

  return {
    salon,
    mostrador,
    cubiertosSalon,
    transaccionesMostrador: cierresConMostrador.size,
  }
}

export async function getMediosPago(from: string, to: string): Promise<MediosPago> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('cierres_caja_active')
    .select('monto_efectivo, monto_tarjetas, monto_qr, monto_online')
    .eq('tenant_id', tenantId)
    .gte('fecha_cierre_local', from)
    .lt('fecha_cierre_local', to)

  if (error) throw new Error(error.message)

  return {
    efectivo: (data ?? []).reduce((s, c) => s + (Number(c.monto_efectivo) || 0), 0),
    tarjetas: (data ?? []).reduce((s, c) => s + (Number(c.monto_tarjetas) || 0), 0),
    qr: (data ?? []).reduce((s, c) => s + (Number(c.monto_qr) || 0), 0),
    online: (data ?? []).reduce((s, c) => s + (Number(c.monto_online) || 0), 0),
  }
}

export async function getTopProductos(
  from: string,
  to: string,
  limit = 10,
): Promise<TopProducto[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('cierre_caja_productos_active')
    .select('nombre, cantidad, monto_total')
    .eq('cierre_tenant_id', tenantId)
    .gte('cierre_fecha_local', from)
    .lt('cierre_fecha_local', to)

  if (error) throw new Error(error.message)

  // Agrupar por nombre normalizado (los PDFs pueden traer variaciones)
  const byName = new Map<string, TopProducto>()
  for (const row of data ?? []) {
    const key = (row.nombre ?? '').trim().toLowerCase()
    if (!key) continue
    const cur = byName.get(key) ?? { nombre: row.nombre ?? '', cantidad: 0, monto: 0 }
    cur.cantidad += Number(row.cantidad) || 0
    cur.monto += Number(row.monto_total) || 0
    byName.set(key, cur)
  }

  return Array.from(byName.values())
    .sort((a, b) => b.cantidad - a.cantidad)
    .slice(0, limit)
}

export async function getProductosEnRiesgo(): Promise<ProductoRiesgo[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('product_costs')
    .select('id, name, sale_price, total_cost, margin_pct, target_margin_pct, active')
    .eq('tenant_id', tenantId)

  if (error) throw new Error(error.message)

  return (data ?? [])
    .filter(
      (p) =>
        p.active &&
        p.target_margin_pct !== null &&
        p.margin_pct !== null &&
        Number(p.margin_pct) < Number(p.target_margin_pct),
    )
    .map((p) => ({
      id: p.id!,
      name: p.name!,
      sale_price: Number(p.sale_price) || 0,
      total_cost: Number(p.total_cost) || 0,
      margin_pct: Number(p.margin_pct),
      target_margin_pct: Number(p.target_margin_pct),
      deficit_pct: Number(p.target_margin_pct) - Number(p.margin_pct),
    }))
    .sort((a, b) => b.deficit_pct - a.deficit_pct)
    .slice(0, 10)
}

export async function getProductosMasRentables(
  from: string,
  to: string,
  limit = 5,
): Promise<ProductoRentable[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const [productosRes, costsRes] = await Promise.all([
    supabase
      .from('cierre_caja_productos_active')
      .select('producto_id, cantidad, monto_total')
      .eq('cierre_tenant_id', tenantId)
      .gte('cierre_fecha_local', from)
      .lt('cierre_fecha_local', to),
    supabase
      .from('product_costs')
      .select('id, name, sale_price, total_cost')
      .eq('tenant_id', tenantId),
  ])

  if (productosRes.error) throw new Error(productosRes.error.message)
  if (costsRes.error) throw new Error(costsRes.error.message)

  const costsMap = new Map(
    (costsRes.data ?? []).map((c) => [
      c.id,
      {
        name: c.name,
        sale_price: Number(c.sale_price) || 0,
        margen: (Number(c.sale_price) || 0) - (Number(c.total_cost) || 0),
      },
    ]),
  )

  const agg = new Map<string, ProductoRentable>()
  for (const row of productosRes.data ?? []) {
    if (!row.producto_id) continue
    const info = costsMap.get(row.producto_id)
    if (!info) continue
    const cur = agg.get(row.producto_id) ?? {
      id: row.producto_id,
      name: info.name!,
      cantidad: 0,
      margen_unitario: info.margen,
      margen_total: 0,
      margin_pct: info.sale_price > 0 ? (info.margen / info.sale_price) * 100 : 0,
    }
    cur.cantidad += Number(row.cantidad) || 0
    cur.margen_total += info.margen * (Number(row.cantidad) || 0)
    agg.set(row.producto_id, cur)
  }

  return Array.from(agg.values())
    .filter((p) => p.margen_total > 0)
    .sort((a, b) => b.margen_total - a.margen_total)
    .slice(0, limit)
}

export type MenuEngineeringPoint = {
  id: string
  name: string
  cantidad: number
  margen_unitario: number
  monto: number
  cuadrante: 'estrella' | 'caballito' | 'acertijo' | 'perro'
}

export async function getMenuEngineering(from: string, to: string): Promise<{
  points: MenuEngineeringPoint[]
  thresholdCantidad: number
  thresholdMargen: number
}> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const [productosRes, costsRes] = await Promise.all([
    supabase
      .from('cierre_caja_productos_active')
      .select('producto_id, cantidad, monto_total')
      .eq('cierre_tenant_id', tenantId)
      .gte('cierre_fecha_local', from)
      .lt('cierre_fecha_local', to),
    supabase
      .from('product_costs')
      .select('id, name, sale_price, total_cost')
      .eq('tenant_id', tenantId),
  ])

  if (productosRes.error) throw new Error(productosRes.error.message)
  if (costsRes.error) throw new Error(costsRes.error.message)

  const costsMap = new Map(
    (costsRes.data ?? []).map((c) => [
      c.id,
      {
        name: c.name,
        margen: (Number(c.sale_price) || 0) - (Number(c.total_cost) || 0),
      },
    ]),
  )

  const agg = new Map<string, { id: string; name: string; cantidad: number; margen_unitario: number; monto: number }>()
  for (const row of productosRes.data ?? []) {
    if (!row.producto_id) continue
    const info = costsMap.get(row.producto_id)
    if (!info) continue
    const cur = agg.get(row.producto_id) ?? {
      id: row.producto_id,
      name: info.name!,
      cantidad: 0,
      margen_unitario: info.margen,
      monto: 0,
    }
    cur.cantidad += Number(row.cantidad) || 0
    cur.monto += Number(row.monto_total) || 0
    agg.set(row.producto_id, cur)
  }

  const arr = Array.from(agg.values()).filter((p) => p.cantidad > 0 && p.margen_unitario !== 0)
  if (arr.length === 0) return { points: [], thresholdCantidad: 0, thresholdMargen: 0 }

  // Visual 50/50: threshold = mitad del rango visible. Garantiza que el cuadrante
  // donde cae el punto coincida con el cuadrante coloreado donde lo dibujamos.
  const maxCantidad = Math.max(...arr.map((p) => p.cantidad))
  const maxMargen = Math.max(...arr.map((p) => p.margen_unitario))
  const minMargen = Math.min(0, ...arr.map((p) => p.margen_unitario))
  const thresholdCantidad = maxCantidad / 2
  const thresholdMargen = (maxMargen + minMargen) / 2

  const points: MenuEngineeringPoint[] = arr.map((p) => {
    const altaCantidad = p.cantidad >= thresholdCantidad
    const altoMargen = p.margen_unitario >= thresholdMargen
    let cuadrante: MenuEngineeringPoint['cuadrante']
    if (altaCantidad && altoMargen) cuadrante = 'estrella'
    else if (altaCantidad && !altoMargen) cuadrante = 'caballito'
    else if (!altaCantidad && altoMargen) cuadrante = 'acertijo'
    else cuadrante = 'perro'
    return { ...p, cuadrante }
  })

  return { points, thresholdCantidad, thresholdMargen }
}

export type InsumoGasto = {
  id: string
  name: string
  unit: string
  total_gastado: number
  qty_total: number
}

export async function getTopInsumosGasto(
  from: string,
  to: string,
  limit = 5,
): Promise<InsumoGasto[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('compra_items')
    .select(
      'insumo_id, qty, unit_price, compras!inner(fecha, tenant_id), insumos!inner(name, unit)',
    )
    .eq('compras.tenant_id', tenantId)
    .gte('compras.fecha', from)
    .lt('compras.fecha', to)

  if (error) throw new Error(error.message)

  const agg = new Map<string, InsumoGasto>()
  for (const row of (data ?? []) as unknown as Array<{
    insumo_id: string
    qty: number
    unit_price: number
    insumos: { name: string; unit: string } | null
  }>) {
    if (!row.insumos) continue
    const cur = agg.get(row.insumo_id) ?? {
      id: row.insumo_id,
      name: row.insumos.name,
      unit: row.insumos.unit,
      total_gastado: 0,
      qty_total: 0,
    }
    cur.total_gastado += (Number(row.qty) || 0) * (Number(row.unit_price) || 0)
    cur.qty_total += Number(row.qty) || 0
    agg.set(row.insumo_id, cur)
  }

  return Array.from(agg.values())
    .sort((a, b) => b.total_gastado - a.total_gastado)
    .slice(0, limit)
}

export type InsumoSubaAlert = {
  id: string
  name: string
  unit: string
  precio_anterior: number
  precio_actual: number
  variacion_pct: number
  proveedor_actual: string | null
}

export async function getInsumosConSuba(
  from: string,
  to: string,
  thresholdPct = 15,
): Promise<InsumoSubaAlert[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { from: prevFrom } = prevPeriod(from, to)

  // Traer todos los precios del mes actual y anterior, en orden cronológico
  const { data, error } = await supabase
    .from('insumo_price_history')
    .select(
      'insumo_id, price, valid_from, proveedores(name), insumos!inner(name, unit, active, tenant_id)',
    )
    .eq('insumos.tenant_id', tenantId)
    .gte('valid_from', prevFrom)
    .lt('valid_from', to)
    .order('valid_from')

  if (error) throw new Error(error.message)

  // Para cada insumo: último precio en mes anterior vs último precio en mes actual
  type Row = {
    insumo_id: string
    price: number
    valid_from: string
    proveedores: { name: string } | null
    insumos: { name: string; unit: string; active: boolean }
  }
  const rows = (data ?? []) as unknown as Row[]

  const lastPrev = new Map<string, Row>()
  const lastCur = new Map<string, Row>()
  for (const r of rows) {
    if (!r.insumos.active) continue
    const isCurrent = r.valid_from >= from
    const map = isCurrent ? lastCur : lastPrev
    const existing = map.get(r.insumo_id)
    if (!existing || existing.valid_from < r.valid_from) {
      map.set(r.insumo_id, r)
    }
  }

  const alerts: InsumoSubaAlert[] = []
  for (const [id, cur] of lastCur) {
    const prev = lastPrev.get(id)
    if (!prev || Number(prev.price) === 0) continue
    const variacion = ((Number(cur.price) - Number(prev.price)) / Number(prev.price)) * 100
    if (variacion < thresholdPct) continue
    alerts.push({
      id,
      name: cur.insumos.name,
      unit: cur.insumos.unit,
      precio_anterior: Number(prev.price),
      precio_actual: Number(cur.price),
      variacion_pct: variacion,
      proveedor_actual: cur.proveedores?.name ?? null,
    })
  }

  return alerts.sort((a, b) => b.variacion_pct - a.variacion_pct).slice(0, 8)
}

export async function getStockCritico(threshold = 0.3): Promise<InsumoCritico[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const [stockRes, insumosRes] = await Promise.all([
    supabase
      .from('insumo_stock')
      .select('insumo_id, unit, stock_actual, stock_referencia')
      .eq('tenant_id', tenantId),
    supabase
      .from('insumos')
      .select('id, name, track_stock, active')
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .eq('track_stock', true),
  ])

  if (stockRes.error) throw new Error(stockRes.error.message)
  if (insumosRes.error) throw new Error(insumosRes.error.message)

  const insumosMap = new Map((insumosRes.data ?? []).map((i) => [i.id, i]))
  const result: InsumoCritico[] = []

  for (const s of stockRes.data ?? []) {
    const insumo = insumosMap.get(s.insumo_id!)
    if (!insumo) continue
    const stock_referencia = Number(s.stock_referencia) || 0
    if (stock_referencia <= 0) continue
    const stock_actual = Number(s.stock_actual) || 0
    const pct = stock_actual / stock_referencia
    if (pct >= threshold) continue
    result.push({
      id: insumo.id,
      name: insumo.name,
      unit: s.unit ?? '',
      stock_actual,
      stock_referencia,
      pct: pct * 100,
    })
  }

  return result.sort((a, b) => a.pct - b.pct).slice(0, 8)
}
