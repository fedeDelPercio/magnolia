import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type DiaOperativo = Tables<'dias_operativos'>

export type MovimientoConProducto = Tables<'movimientos_diarios'> & {
  productos: Pick<Tables<'productos'>, 'name' | 'sale_price' | 'concepto_id' | 'canal' | 'formato'>
}

export type DiaConMovimientos = DiaOperativo & {
  movimientos_diarios: MovimientoConProducto[]
}

export async function getDias(): Promise<DiaOperativo[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('dias_operativos')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('fecha', { ascending: false })
    .limit(60)

  if (error) throw new Error(error.message)
  return data
}

/** Días operativos en un mes específico ('YYYY-MM'). */
export async function getDiasMes(month: string): Promise<DiaOperativo[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const from = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year! + 1}-01-01` : `${year}-${String(mon! + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('dias_operativos')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('fecha', from)
    .lt('fecha', nextMonth)
    .order('fecha', { ascending: true })

  if (error) throw new Error(error.message)
  return data
}

// ---- Diferencias acumuladas del mes ------------------------------------
// Resumen para Carolina: cuánta diferencia (conteo físico vs teórico) se
// acumuló en el mes, por producto. Espeja el agrupado de la grilla diaria
// (variantes barra+salón sumadas, menú aparte) y solo suma los días donde la
// fila tiene conteo cargado — un día sin conteo no genera diferencia.
// Nota: la grilla guarda conteo 0 cuando se edita una fila sin contar, así
// que "contado" incluye esos ceros (igual que la columna Diferencia del día);
// los día-producto con conteo 0 y teórico 0 se ignoran (no dicen nada).

export type DiferenciaDia = {
  fecha: string
  conteo: number
  teorico: number
  dif: number
}

export type DiferenciaProducto = {
  productoId: string
  name: string
  diasContados: number
  faltante: number // suma de diferencias negativas (≤ 0)
  sobrante: number // suma de diferencias positivas (≥ 0)
  neto: number
  // Costo por unidad para valorizar. null = sin costo confiable (sin receta o
  // receta con unidades incompatibles) → se muestran solo unidades.
  costoUnitario: number | null
  pesos: number | null
  dias: DiferenciaDia[]
}

export type DiferenciasMes = {
  productos: DiferenciaProducto[]
  diasConConteo: number
  netoUnidades: number
  pesosTotal: number
  sinCostoConfiable: number
}

export async function getDiferenciasMes(month: string): Promise<DiferenciasMes> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const from = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const to = mon === 12 ? `${year! + 1}-01-01` : `${year}-${String(mon! + 1).padStart(2, '0')}-01`

  type MovRow = {
    producto_id: string
    conteo_fisico: number | null
    stock_anterior: number
    produccion: number
    ventas: number
    desperdicio: number
    almuerzo: number
    dias_operativos: { fecha: string }
    productos: { name: string; concepto_id: string | null; canal: string | null; formato: string | null }
  }

  // Un mes completo son ~3.500 filas (31 días × catálogo); Supabase corta en
  // 1000 por request, así que paginamos hasta agotar.
  const rows: MovRow[] = []
  const pageSize = 1000
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from('movimientos_diarios')
      .select(
        'producto_id, conteo_fisico, stock_anterior, produccion, ventas, desperdicio, almuerzo, dias_operativos!inner(fecha, tenant_id), productos!inner(name, concepto_id, canal, formato)',
      )
      .eq('dias_operativos.tenant_id', tenantId)
      .gte('dias_operativos.fecha', from)
      .lt('dias_operativos.fecha', to)
      .range(offset, offset + pageSize - 1)
    if (error) throw new Error(error.message)
    const page = (data ?? []) as unknown as MovRow[]
    rows.push(...page)
    if (page.length < pageSize) break
  }

  const [costsRes, rotasRes] = await Promise.all([
    supabase.from('product_costs').select('id, total_cost').eq('tenant_id', tenantId),
    supabase.rpc('productos_unidades_rotas', { p_tenant_id: tenantId }),
  ])
  const costMap = new Map(
    (costsRes.data ?? []).map((c) => [c.id as string, Number(c.total_cost) || 0]),
  )
  const rotas = new Set((rotasRes.data ?? []).map((r) => r.producto_id))

  // Agrupar por (grupo de producto, fecha) — mismo criterio que la grilla:
  // concepto (sin menú) = una fila; el resto, por producto.
  type DayAgg = {
    contado: boolean
    conteo: number
    teorico: number
    baseId: string | null
    baseName: string | null
    anyId: string
    anyName: string
  }
  const porDia = new Map<string, DayAgg>()
  for (const r of rows) {
    const p = r.productos
    const isMenu = p.formato === 'menu'
    const gkey = p.concepto_id && !isMenu ? `c:${p.concepto_id}` : `p:${r.producto_id}`
    const key = `${gkey}|${r.dias_operativos.fecha}`
    const cur = porDia.get(key) ?? {
      contado: false,
      conteo: 0,
      teorico: 0,
      baseId: null,
      baseName: null,
      anyId: r.producto_id,
      anyName: p.name,
    }
    if (r.conteo_fisico !== null) cur.contado = true
    cur.conteo += Number(r.conteo_fisico) || 0
    cur.teorico +=
      (Number(r.stock_anterior) || 0) +
      (Number(r.produccion) || 0) -
      (Number(r.ventas) || 0) -
      (Number(r.desperdicio) || 0) -
      (Number(r.almuerzo) || 0)
    if (p.canal === null && !isMenu) {
      cur.baseId = r.producto_id
      cur.baseName = p.name
    }
    porDia.set(key, cur)
  }

  type ProdAgg = {
    productoId: string
    name: string
    diasContados: number
    faltante: number
    sobrante: number
    dias: DiferenciaDia[]
  }
  const porProducto = new Map<string, ProdAgg>()
  const fechasConConteo = new Set<string>()

  for (const [key, d] of porDia) {
    if (!d.contado) continue
    if (d.conteo === 0 && Math.abs(d.teorico) < 0.005) continue
    const fecha = key.slice(key.indexOf('|') + 1)
    const gkey = key.slice(0, key.indexOf('|'))
    fechasConConteo.add(fecha)
    const dif = d.conteo - d.teorico
    const cur = porProducto.get(gkey) ?? {
      productoId: d.baseId ?? d.anyId,
      name: d.baseName ?? d.anyName,
      diasContados: 0,
      faltante: 0,
      sobrante: 0,
      dias: [],
    }
    cur.diasContados += 1
    if (dif < 0) cur.faltante += dif
    else cur.sobrante += dif
    if (Math.abs(dif) >= 0.005) {
      cur.dias.push({ fecha, conteo: d.conteo, teorico: d.teorico, dif })
    }
    porProducto.set(gkey, cur)
  }

  let netoUnidades = 0
  let pesosTotal = 0
  let sinCostoConfiable = 0
  const productos: DiferenciaProducto[] = []
  for (const p of porProducto.values()) {
    const neto = p.faltante + p.sobrante
    if (Math.abs(neto) < 0.005 && Math.abs(p.faltante) < 0.005) continue
    const cost = costMap.get(p.productoId) ?? 0
    const confiable = cost > 0 && !rotas.has(p.productoId)
    const pesos = confiable ? neto * cost : null
    if (!confiable) sinCostoConfiable += 1
    netoUnidades += neto
    if (pesos !== null) pesosTotal += pesos
    p.dias.sort((a, b) => a.fecha.localeCompare(b.fecha))
    productos.push({
      productoId: p.productoId,
      name: p.name,
      diasContados: p.diasContados,
      faltante: p.faltante,
      sobrante: p.sobrante,
      neto,
      costoUnitario: confiable ? cost : null,
      pesos,
      dias: p.dias,
    })
  }

  productos.sort(
    (a, b) =>
      Math.abs(b.pesos ?? 0) - Math.abs(a.pesos ?? 0) || Math.abs(b.neto) - Math.abs(a.neto),
  )

  return {
    productos,
    diasConConteo: fechasConConteo.size,
    netoUnidades,
    pesosTotal,
    sinCostoConfiable,
  }
}

export async function getDia(diaId: string): Promise<DiaConMovimientos | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dias_operativos')
    .select(`
      *,
      movimientos_diarios(
        *,
        productos(name, sale_price, concepto_id, canal, formato)
      )
    `)
    .eq('id', diaId)
    .single()

  if (error || !data) return null

  // Si el día está abierto: (1) agregamos movimientos para productos activos
  // creados después de abrir el día; (2) arrastramos automáticamente el
  // stock_anterior desde el día previo en las filas NO editadas a mano
  // (conteo físico, o teórico en vivo si no se contó; cortado en 0). Así el
  // stock inicial siempre refleja lo que quedó ayer sin tener que cerrar el día.
  // Los días cerrados son inmutables.
  if (data.status === 'abierto') {
    const existingProductIds = new Set(
      (data.movimientos_diarios as unknown as Array<{ producto_id: string }>).map((m) => m.producto_id),
    )

    const { data: activeProducts } = await supabase
      .from('productos')
      .select('id')
      .eq('tenant_id', data.tenant_id)
      .eq('active', true)

    const missing = (activeProducts ?? []).filter((p) => !existingProductIds.has(p.id))

    let changed = false

    if (missing.length > 0) {
      // Los insertamos en 0; sync_stock_inicial les deriva el stock del día previo.
      await supabase.from('movimientos_diarios').insert(
        missing.map((p) => ({
          dia_id: diaId,
          producto_id: p.id,
          produccion: 0,
          ventas: 0,
          desperdicio: 0,
          almuerzo: 0,
        })),
      )
      changed = true
    }

    const { data: synced } = await supabase.rpc('sync_stock_inicial', { p_dia_id: diaId })
    if ((synced ?? 0) > 0) changed = true

    if (changed) {
      const { data: refreshed } = await supabase
        .from('dias_operativos')
        .select(`
          *,
          movimientos_diarios(
            *,
            productos(name, sale_price, concepto_id, canal, formato)
          )
        `)
        .eq('id', diaId)
        .single()

      return refreshed as unknown as DiaConMovimientos
    }
  }

  return data as unknown as DiaConMovimientos
}
