import { createClient } from '@/lib/supabase/server'
import { fetchAllPaged } from '@/lib/supabase/paginate'
import { getActiveTenantId } from '@/lib/tenant/server'

// Mismos tipos digitales que ya considera el resto del sistema
const DIGITAL_METHODS = new Set([
  'TARJETA', 'TARJETA DE CREDITO', 'TARJETA DE DEBITO', 'TARJETAS',
  'QR', 'MERCADO PAGO QR',
  'ONLINE', 'MERCADO PAGO', 'TRANSFERENCIA',
])
const VENTA_TYPES = new Set([
  'VENTA',
  'VENTA (Multipago)',
  'VENTA (Pago parcial)',
  'COMANDA',
  'COMANDA (Multipago)',
  'COMANDA (Pago parcial)',
])

export type CuentaDigitalMovimiento = {
  id: string
  fecha: string
  tipo: 'ingreso' | 'egreso'
  monto: number                 // monto NETO (descontando impuestos en ingresos)
  descripcion: string
  source: 'bistro_venta' | 'caja_movimiento' | 'traspaso_caja_mayor'
  // Solo egresos manuales de categoria 'Egreso digital' pueden borrarse desde
  // acá — los pagos a proveedor y los traspasos se gestionan desde su feature.
  eliminable: boolean
}

export type CuentaDigitalSummary = {
  saldo: number                 // ingresos netos acumulados - egresos acumulados
  ingresosMes: number           // ventas digital del mes (neto)
  egresosMes: number            // transferencias del mes + traspasos a caja mayor del mes
  costoProcesadorPct: number    // costo del procesador aplicado (MP, banco, etc.)
  movimientosMes: CuentaDigitalMovimiento[]
}

// Saldo y movimientos:
//
//   ingresos = ventas Bistro tarjetas+qr+online * (1 - costoProcesadorPct)
//   egresos  = pagos a proveedor donde el pago.metodo='transferencia'
//            + caja_movimientos egresos manuales con categoria 'Egreso digital'
//            + caja_mayor_movimientos con origen='cuenta_digital'
//
// Acumulado = hasta el fin del mes seleccionado.
// costoProcesadorPct = comision del procesador digital (Mercado Pago, banco).
// No se confunde con el IVA digital, que vive en /dashboard como balanza fiscal.
export async function getCuentaDigitalSummary(month: string, costoProcesadorPct: number): Promise<CuentaDigitalSummary> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const from = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const nextMonth = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`
  const netoFactor = 1 - costoProcesadorPct / 100

  const [
    ventasAccRows,
    ventasMesRows,
    cajaAccRows,
    cajaMesRows,
    pagosByMetodoRows,
    traspasosAcc,
    traspasosMes,
    ingresosManualesAcc,
    ingresosManualesMes,
  ] = await Promise.all([
    // Ventas acumuladas — pagina porque puede haber decenas de miles de rows
    fetchAllPaged<{ amount_total: number; payment_method: string | null; transaction_type: string | null }>((rf, rt) =>
      supabase
        .from('bistro_transacciones')
        .select('amount_total, payment_method, transaction_type')
        .eq('tenant_id', tenantId)
        .lt('fecha_local', nextMonth)
        .range(rf, rt),
    ),
    fetchAllPaged<{ fecha_local: string | null; amount_total: number; payment_method: string | null; transaction_type: string | null }>((rf, rt) =>
      supabase
        .from('bistro_transacciones')
        .select('fecha_local, amount_total, payment_method, transaction_type')
        .eq('tenant_id', tenantId)
        .gte('fecha_local', from)
        .lt('fecha_local', nextMonth)
        .range(rf, rt),
    ),
    fetchAllPaged<{ id: string; fecha: string; monto: number; descripcion: string | null; ref_kind: string | null; ref_id: string | null; categoria: string }>((rf, rt) =>
      supabase
        .from('caja_movimientos')
        .select('id, fecha, monto, descripcion, ref_kind, ref_id, categoria')
        .eq('tenant_id', tenantId)
        .eq('tipo', 'egreso')
        .lt('fecha', nextMonth)
        .range(rf, rt),
    ),
    fetchAllPaged<{ id: string; fecha: string; monto: number; descripcion: string | null; ref_kind: string | null; ref_id: string | null; categoria: string }>((rf, rt) =>
      supabase
        .from('caja_movimientos')
        .select('id, fecha, monto, descripcion, ref_kind, ref_id, categoria')
        .eq('tenant_id', tenantId)
        .eq('tipo', 'egreso')
        .gte('fecha', from)
        .lt('fecha', nextMonth)
        .order('fecha', { ascending: false })
        .range(rf, rt),
    ),
    supabase
      .from('pagos_proveedor')
      .select('id, metodo')
      .eq('tenant_id', tenantId),
    supabase
      .from('caja_mayor_movimientos')
      .select('monto')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'ingreso')
      .eq('origen', 'cuenta_digital')
      .lt('fecha', nextMonth),
    supabase
      .from('caja_mayor_movimientos')
      .select('id, fecha, monto, descripcion')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'ingreso')
      .eq('origen', 'cuenta_digital')
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false }),
    // Ingresos manuales a cuenta digital (transferencias recibidas, devoluciones,
    // adelantos). Se cargan desde la card con categoria='Ingreso digital'.
    // Acumulado hasta el fin del mes seleccionado.
    supabase
      .from('caja_movimientos')
      .select('monto')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'ingreso')
      .eq('categoria', 'Ingreso digital')
      .lt('fecha', nextMonth),
    supabase
      .from('caja_movimientos')
      .select('id, fecha, monto, descripcion, ref_kind')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'ingreso')
      .eq('categoria', 'Ingreso digital')
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false }),
  ])

  // Index de pagos por id -> metodo
  const pagoMetodo = new Map<string, string>()
  for (const p of pagosByMetodoRows.data ?? []) pagoMetodo.set(p.id, p.metodo ?? '')

  function isEgresoDigital(r: { ref_kind: string | null; ref_id: string | null; categoria: string }): boolean {
    if (r.categoria === 'Egreso digital') return true
    if (r.ref_kind === 'pago_proveedor' && r.ref_id) {
      return pagoMetodo.get(r.ref_id) === 'transferencia'
    }
    return false
  }

  // 1. Ingresos acumulados: ventas digital netas + ingresos manuales.
  // Los manuales no se netean por costoProcesadorPct porque son plata que ya
  // entro a la cuenta (transferencia externa recibida), no una venta que
  // pase por el procesador.
  let ingresosAcc = 0
  for (const r of ventasAccRows) {
    const type = r.transaction_type ?? ''
    const method = (r.payment_method ?? '').toUpperCase()
    if (!VENTA_TYPES.has(type) || !DIGITAL_METHODS.has(method)) continue
    ingresosAcc += Number(r.amount_total) || 0
  }
  ingresosAcc = ingresosAcc * netoFactor
  ingresosAcc += (ingresosManualesAcc.data ?? []).reduce((s, r) => s + (Number(r.monto) || 0), 0)

  // 2. Ingresos del mes (agregados por dia para no listar miles de comandas)
  let ingresosMes = 0
  const ingresosByDay = new Map<string, number>()
  for (const r of ventasMesRows) {
    const type = r.transaction_type ?? ''
    const method = (r.payment_method ?? '').toUpperCase()
    if (!VENTA_TYPES.has(type) || !DIGITAL_METHODS.has(method)) continue
    const neto = (Number(r.amount_total) || 0) * netoFactor
    ingresosMes += neto
    const key = r.fecha_local ?? ''
    ingresosByDay.set(key, (ingresosByDay.get(key) ?? 0) + neto)
  }
  // Ingresos manuales del mes al total (no van agrupados por dia — se listan
  // uno por uno en el detalle para que sean eliminables).
  for (const r of ingresosManualesMes.data ?? []) {
    ingresosMes += Number(r.monto) || 0
  }

  // 3. Egresos: caja_movimientos digitales (acumulado)
  let egresosAcc = 0
  for (const r of cajaAccRows) {
    if (isEgresoDigital(r)) egresosAcc += Number(r.monto) || 0
  }
  // + traspasos a caja mayor
  egresosAcc += (traspasosAcc.data ?? []).reduce((s, r) => s + (Number(r.monto) || 0), 0)

  // 4. Egresos del mes (con detalle)
  let egresosMes = 0
  const movimientosMes: CuentaDigitalMovimiento[] = []
  for (const r of cajaMesRows) {
    if (!isEgresoDigital(r)) continue
    const monto = Number(r.monto) || 0
    egresosMes += monto
    movimientosMes.push({
      id: r.id,
      fecha: r.fecha,
      tipo: 'egreso',
      monto,
      descripcion: r.descripcion ?? r.categoria,
      source: 'caja_movimiento',
      // Solo los manuales (sin ref_kind) son eliminables desde esta card.
      // Los pagos a proveedor se manejan desde /proveedores para no romper
      // la ref circular pago<->caja_movimiento.
      eliminable: r.categoria === 'Egreso digital' && !r.ref_kind,
    })
  }
  for (const t of traspasosMes.data ?? []) {
    const monto = Number(t.monto) || 0
    egresosMes += monto
    movimientosMes.push({
      id: `traspaso-${t.id}`,
      fecha: t.fecha,
      tipo: 'egreso',
      monto,
      descripcion: t.descripcion ?? 'Traspaso a caja mayor',
      source: 'traspaso_caja_mayor',
      eliminable: false,
    })
  }

  // Agregar ingresos manuales (transferencias recibidas externas) uno por uno.
  // Son eliminables si no tienen ref_kind (los cargo Caro desde la card).
  for (const r of ingresosManualesMes.data ?? []) {
    movimientosMes.push({
      id: r.id,
      fecha: r.fecha,
      tipo: 'ingreso',
      monto: Number(r.monto) || 0,
      descripcion: r.descripcion ?? 'Ingreso digital',
      source: 'caja_movimiento',
      eliminable: !r.ref_kind,
    })
  }

  // Agregar ingresos por dia al final
  for (const [fecha, total] of ingresosByDay) {
    movimientosMes.push({
      id: `ventas-${fecha}`,
      fecha,
      tipo: 'ingreso',
      monto: total,
      descripcion: `Ventas digital (neto ${(100 - costoProcesadorPct).toFixed(2)}%)`,
      source: 'bistro_venta',
      eliminable: false,
    })
  }

  return {
    saldo: ingresosAcc - egresosAcc,
    ingresosMes,
    egresosMes,
    costoProcesadorPct,
    movimientosMes: movimientosMes.sort((a, b) => b.fecha.localeCompare(a.fecha)),
  }
}
