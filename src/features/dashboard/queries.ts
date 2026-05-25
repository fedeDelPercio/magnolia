import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

/* ---------- helpers ---------- */

function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const from = `${month}-01`
  const to = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`
  return { from, to }
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  if (m === 1) return `${y! - 1}-12`
  return `${y}-${String(m! - 1).padStart(2, '0')}`
}

/* ---------- types ---------- */

export type DashboardOverview = {
  facturacion: number
  facturacionPrev: number
  facturacionDeltaPct: number | null
  cubiertosSalon: number
  ticketPromedioSalon: number
  foodCostPct: number | null
  foodCostMonto: number
  margenPonderadoPct: number | null
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

export async function getDashboardOverview(month: string): Promise<DashboardOverview> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { from, to } = monthBounds(month)
  const { from: prevFrom, to: prevTo } = monthBounds(prevMonth(month))

  const [cierresRes, cierresPrevRes, productosRes] = await Promise.all([
    supabase
      .from('cierres_caja')
      .select('total_vendido, monto_salon, cubiertos')
      .eq('tenant_id', tenantId)
      .gte('fecha_cierre', from)
      .lt('fecha_cierre', to),
    supabase
      .from('cierres_caja')
      .select('total_vendido')
      .eq('tenant_id', tenantId)
      .gte('fecha_cierre', prevFrom)
      .lt('fecha_cierre', prevTo),
    supabase
      .from('cierre_caja_productos')
      .select('cantidad, monto_total, producto_id, cierres_caja!inner(fecha_cierre, tenant_id)')
      .eq('cierres_caja.tenant_id', tenantId)
      .gte('cierres_caja.fecha_cierre', from)
      .lt('cierres_caja.fecha_cierre', to),
  ])

  if (cierresRes.error) throw new Error(cierresRes.error.message)
  if (cierresPrevRes.error) throw new Error(cierresPrevRes.error.message)
  if (productosRes.error) throw new Error(productosRes.error.message)

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

  return {
    facturacion,
    facturacionPrev,
    facturacionDeltaPct,
    cubiertosSalon,
    ticketPromedioSalon,
    foodCostPct,
    foodCostMonto,
    margenPonderadoPct,
  }
}

export async function getDailyVentas(month: string): Promise<DailyVentas[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { from, to } = monthBounds(month)

  const { data, error } = await supabase
    .from('cierres_caja')
    .select('fecha_cierre, total_vendido, monto_salon, monto_mostrador')
    .eq('tenant_id', tenantId)
    .gte('fecha_cierre', from)
    .lt('fecha_cierre', to)
    .order('fecha_cierre')

  if (error) throw new Error(error.message)

  // Agrupar por día (puede haber más de 1 cierre por día)
  const byDay = new Map<string, DailyVentas>()
  for (const c of data ?? []) {
    const fecha = c.fecha_cierre.slice(0, 10)
    const cur = byDay.get(fecha) ?? { fecha, total: 0, salon: 0, mostrador: 0 }
    cur.total += Number(c.total_vendido) || 0
    cur.salon += Number(c.monto_salon) || 0
    cur.mostrador += Number(c.monto_mostrador) || 0
    byDay.set(fecha, cur)
  }

  return Array.from(byDay.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export async function getMixData(month: string): Promise<MixData> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { from, to } = monthBounds(month)

  const [cierresRes, productosRes] = await Promise.all([
    supabase
      .from('cierres_caja')
      .select('id, monto_salon, monto_mostrador, cubiertos')
      .eq('tenant_id', tenantId)
      .gte('fecha_cierre', from)
      .lt('fecha_cierre', to),
    supabase
      .from('cierre_caja_productos')
      .select('categoria, cierre_caja_id, cierres_caja!inner(fecha_cierre, tenant_id)')
      .eq('cierres_caja.tenant_id', tenantId)
      .gte('cierres_caja.fecha_cierre', from)
      .lt('cierres_caja.fecha_cierre', to),
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

export async function getMediosPago(month: string): Promise<MediosPago> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { from, to } = monthBounds(month)

  const { data, error } = await supabase
    .from('cierres_caja')
    .select('monto_efectivo, monto_tarjetas, monto_qr, monto_online')
    .eq('tenant_id', tenantId)
    .gte('fecha_cierre', from)
    .lt('fecha_cierre', to)

  if (error) throw new Error(error.message)

  return {
    efectivo: (data ?? []).reduce((s, c) => s + (Number(c.monto_efectivo) || 0), 0),
    tarjetas: (data ?? []).reduce((s, c) => s + (Number(c.monto_tarjetas) || 0), 0),
    qr: (data ?? []).reduce((s, c) => s + (Number(c.monto_qr) || 0), 0),
    online: (data ?? []).reduce((s, c) => s + (Number(c.monto_online) || 0), 0),
  }
}

export async function getTopProductos(month: string, limit = 10): Promise<TopProducto[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { from, to } = monthBounds(month)

  const { data, error } = await supabase
    .from('cierre_caja_productos')
    .select('nombre, cantidad, monto_total, cierres_caja!inner(fecha_cierre, tenant_id)')
    .eq('cierres_caja.tenant_id', tenantId)
    .gte('cierres_caja.fecha_cierre', from)
    .lt('cierres_caja.fecha_cierre', to)

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
  month: string,
  limit = 5,
): Promise<ProductoRentable[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { from, to } = monthBounds(month)

  const [productosRes, costsRes] = await Promise.all([
    supabase
      .from('cierre_caja_productos')
      .select('producto_id, cantidad, monto_total, cierres_caja!inner(fecha_cierre, tenant_id)')
      .eq('cierres_caja.tenant_id', tenantId)
      .gte('cierres_caja.fecha_cierre', from)
      .lt('cierres_caja.fecha_cierre', to),
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
