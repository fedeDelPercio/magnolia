import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Database, Tables } from '@/types/database'
import { AJUSTE_CATEGORIA } from './constants'

// Bucket categoriza el movimiento para la UI:
// - 'ingreso'/'egreso': flujo real de caja (afecta totales del mes).
// - 'traspaso': plata que cambio de cuenta interna (POS -> caja fuerte,
//   digital -> caja mayor, caja mayor -> fondo, etc). NO afecta totales.
// - 'ganancia_duenos': retiro de ganancia (OTROS - RCA). Es un egreso real
//   pero conceptualmente distinto — sale del sistema, no vuelve.
export type CajaMovimientoBucket = 'ingreso' | 'egreso' | 'traspaso' | 'ganancia_duenos'

// Las 4 cuentas del negocio que un movimiento puede afectar.
export type CuentaCaja = 'efectivo' | 'digital' | 'caja_mayor' | 'fondo'

// Extendemos el row con info del pago referenciado (cuando ref_kind='pago_proveedor')
// para poder distinguir cheque vs efectivo/transferencia en la grilla. Sólo afecta
// movimientos creados por pagos a proveedor; el resto queda con metodo=null.
export type CajaMovimiento = Tables<'caja_movimientos'> & {
  metodo: Database['public']['Enums']['pago_metodo'] | null
  due_date: string | null
  cleared_at: string | null
  empleado_name: string | null
  bucket: CajaMovimientoBucket
  // De que cuenta SALE la plata y a cual ENTRA. Un egreso comun tiene solo
  // origen; un ingreso solo destino; un traspaso tiene ambos. null/null =
  // no afecta ninguna cuenta todavia (ej. pago con cheque hasta que se cobra).
  cuenta_origen: CuentaCaja | null
  cuenta_destino: CuentaCaja | null
  // Si false, la fila es informativa y NO suma a los totales del mes de /caja:
  // traspasos, ajustes de caja, y los movimientos de caja mayor / fondo que se
  // listan aca por visibilidad pero cuyo flujo vive en su propia cuenta.
  counts_in_totals: boolean
  // Solo movs manuales cargados desde /caja son eliminables desde acá. Los que
  // vienen del sync (bistro_tx) o de otros features (pago_proveedor,
  // liquidacion_empleado, caja mayor, fondo) se gestionan desde su origen.
  eliminable: boolean
}

// Mismas categorias que getCuentaDigitalSummary considera egresos digitales
// manuales (cargados desde la card de cuenta digital, sin ref_kind).
const CATEGORIAS_EGRESO_DIGITAL = new Set([
  'Egreso digital', 'Pago a empleados', 'Pago a proveedores', AJUSTE_CATEGORIA,
])
const CATEGORIAS_INGRESO_DIGITAL = new Set(['Ingreso digital', AJUSTE_CATEGORIA])

export async function getCajaMovimientos(month: string): Promise<CajaMovimiento[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const from = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year! + 1}-01-01` : `${year}-${String(mon! + 1).padStart(2, '0')}-01`

  const [{ data, error }, traspasosRes, cajaMayorRes, fondoRes] = await Promise.all([
    supabase
      .from('caja_movimientos')
      .select('*')
      .eq('tenant_id', tenantId)
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    // Traspasos automaticos POS -> caja fuerte (RETIRO POR CIERRE que el sync
    // materializa en caja_mayor_movimientos). Se listan como movimientos
    // informativos en /caja pero no suman/restan al total del mes.
    supabase
      .from('caja_mayor_movimientos')
      .select('id, fecha, monto, descripcion, created_at, bistro_tx_id, origen, source')
      .eq('tenant_id', tenantId)
      .eq('source', 'bistro')
      .eq('origen', 'caja_efectivo')
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    // Movimientos MANUALES de caja mayor: se listan aca por visibilidad (y para
    // poder filtrar por cuenta), pero no suman a los totales del mes — el flujo
    // de caja mayor vive en su card. Los 'bistro' ya entran como traspasos.
    supabase
      .from('caja_mayor_movimientos')
      .select('id, fecha, tipo, monto, descripcion, categoria, origen, created_at')
      .eq('tenant_id', tenantId)
      .eq('source', 'manual')
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false }),
    // Movimientos del fondo de emergencia (manuales o derivados desde otra
    // cuenta). Mismo criterio: visibilidad + filtro, sin tocar totales.
    supabase
      .from('fondo_emergencia_movimientos')
      .select('id, fecha, tipo, monto, descripcion, categoria, origen, created_at')
      .eq('tenant_id', tenantId)
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false }),
  ])

  if (error) throw new Error(error.message)
  const rows = data ?? []

  // Hidratar metodo + due_date desde pagos_proveedor cuando aplica.
  const pagoIds = rows
    .filter((m) => m.ref_kind === 'pago_proveedor' && m.ref_id)
    .map((m) => m.ref_id!)
  const pagosMap = new Map<
    string,
    { metodo: CajaMovimiento['metodo']; due_date: string | null; cleared_at: string | null }
  >()
  if (pagoIds.length > 0) {
    const { data: pagos } = await supabase
      .from('pagos_proveedor')
      .select('id, metodo, due_date, cleared_at')
      .in('id', pagoIds)
    for (const p of pagos ?? []) {
      pagosMap.set(p.id, { metodo: p.metodo, due_date: p.due_date, cleared_at: p.cleared_at })
    }
  }

  // Metodo de los pagos a proveedores de SERVICIO: el link es inverso
  // (proveedor_servicio_pagos.caja_movimiento_id -> caja_movimientos.id).
  const servicioIds = rows.filter((m) => m.ref_kind === 'pago_servicio').map((m) => m.id)
  const servicioMetodoByCajaId = new Map<string, string>()
  if (servicioIds.length > 0) {
    const { data: servicios } = await supabase
      .from('proveedor_servicio_pagos')
      .select('caja_movimiento_id, metodo')
      .in('caja_movimiento_id', servicioIds)
    for (const s of servicios ?? []) {
      if (s.caja_movimiento_id) servicioMetodoByCajaId.set(s.caja_movimiento_id, s.metodo ?? '')
    }
  }

  // Hidratar nombre del empleado cuando ref_kind='liquidacion_empleado'.
  const liqIds = rows
    .filter((m) => m.ref_kind === 'liquidacion_empleado' && m.ref_id)
    .map((m) => m.ref_id!)
  const empNameMap = new Map<string, string>()
  if (liqIds.length > 0) {
    const { data: liqs } = await supabase
      .from('empleado_liquidaciones')
      .select('id, empleados(name)')
      .in('id', liqIds)
    for (const l of liqs ?? []) {
      const row = l as unknown as { id: string; empleados: { name: string } | null }
      if (row.empleados) empNameMap.set(row.id, row.empleados.name)
    }
  }

  // De que cuenta sale / a cual entra la plata de un caja_movimiento.
  function cuentasDe(
    m: Tables<'caja_movimientos'>,
    metodo: string | null,
  ): { origen: CuentaCaja | null; destino: CuentaCaja | null } {
    if (!m.ref_kind) {
      // Movs manuales de la card de cuenta digital (o legacy sin ref_kind).
      if (m.tipo === 'ingreso') {
        return CATEGORIAS_INGRESO_DIGITAL.has(m.categoria)
          ? { origen: null, destino: 'digital' }
          : { origen: null, destino: 'efectivo' }
      }
      return CATEGORIAS_EGRESO_DIGITAL.has(m.categoria)
        ? { origen: 'digital', destino: null }
        : { origen: 'efectivo', destino: null }
    }
    switch (m.ref_kind) {
      // Gastos cargados desde /caja y derivados del POS: salen del efectivo.
      case 'gasto_manual':
      case 'bistro_tx':
      case 'liquidacion_empleado':
        return { origen: 'efectivo', destino: null }
      // Pagos a proveedor (insumos o servicio): la cuenta depende del metodo.
      // Cheque/otro no afecta ninguna cuenta hasta que se cobra.
      case 'pago_proveedor':
      case 'pago_servicio':
        if (metodo === 'transferencia') return { origen: 'digital', destino: null }
        if (metodo === 'efectivo') return { origen: 'efectivo', destino: null }
        return { origen: null, destino: null }
      default:
        return { origen: null, destino: null }
    }
  }

  const hydrated: CajaMovimiento[] = rows.map((m) => {
    const hit = m.ref_kind === 'pago_proveedor' && m.ref_id ? pagosMap.get(m.ref_id) : null
    const servicioMetodo = m.ref_kind === 'pago_servicio' ? servicioMetodoByCajaId.get(m.id) ?? null : null
    const empName =
      m.ref_kind === 'liquidacion_empleado' && m.ref_id ? empNameMap.get(m.ref_id) ?? null : null
    // Bucket para la UI: RCA (bistro_tx + categoria='Ganancia dueños') tiene
    // tratamiento visual distinto que un egreso comun.
    const isGanancia =
      m.ref_kind === 'bistro_tx' && m.categoria === 'Ganancia dueños'
    const bucket: CajaMovimientoBucket = isGanancia
      ? 'ganancia_duenos'
      : (m.tipo as 'ingreso' | 'egreso')
    // Eliminable = mov manual cargado desde /caja o desde la card de cuenta
    // digital. Se dan las mismas categorias que ofrece la card, mas los
    // egresos comunes registrados desde EgresoDialog en /caja (categorias
    // libres del user, sin ref_kind).
    const CATEGORIAS_ELIMINABLES = new Set([
      'Egreso digital', 'Ingreso digital', 'Pago a empleados', AJUSTE_CATEGORIA,
    ])
    const eliminable = !m.ref_kind && (
      CATEGORIAS_ELIMINABLES.has(m.categoria) ||
      // Egresos manuales cargados desde EgresoDialog en /caja: cualquier cat
      // libre (Compras, Servicios, etc.) queda eliminable siempre que no tenga
      // ref_kind (o sea que no venga vinculado a otro feature).
      m.tipo === 'egreso'
    )
    const { origen, destino } = cuentasDe(m, hit?.metodo ?? servicioMetodo)
    return {
      ...m,
      metodo: hit?.metodo ?? (servicioMetodo as CajaMovimiento['metodo']) ?? null,
      due_date: hit?.due_date ?? null,
      cleared_at: hit?.cleared_at ?? null,
      empleado_name: empName,
      bucket,
      cuenta_origen: origen,
      cuenta_destino: destino,
      // Los ajustes corrigen el saldo de su cuenta pero no son flujo del mes.
      counts_in_totals: m.categoria !== AJUSTE_CATEGORIA,
      eliminable,
    }
  })

  // Fila sintetizada comun para movimientos que viven en otras tablas (caja
  // mayor, fondo). Informativos: no suman a totales ni se borran desde aca.
  function sintetizada(base: {
    id: string
    fecha: string
    tipo: 'ingreso' | 'egreso'
    categoria: string
    monto: number
    descripcion: string | null
    ref_kind: string
    ref_id: string
    created_at: string
    bucket: CajaMovimientoBucket
    cuenta_origen: CuentaCaja | null
    cuenta_destino: CuentaCaja | null
  }): CajaMovimiento {
    return {
      tenant_id: tenantId,
      updated_at: base.created_at,
      metodo: null,
      due_date: null,
      cleared_at: null,
      empleado_name: null,
      counts_in_totals: false,
      eliminable: false,
      ...base,
    }
  }

  // Traspasos POS -> caja fuerte (source='bistro'). Igual que antes.
  const traspasos: CajaMovimiento[] = (traspasosRes.data ?? []).map((t) =>
    sintetizada({
      id: `traspaso-${t.id}`,
      fecha: t.fecha,
      tipo: 'egreso',
      categoria: 'Traspaso a caja fuerte',
      monto: Number(t.monto) || 0,
      descripcion: t.descripcion ?? 'Retiro por cierre (Bistro)',
      ref_kind: 'caja_mayor_traspaso',
      ref_id: t.id,
      created_at: t.created_at,
      bucket: 'traspaso',
      cuenta_origen: 'efectivo',
      cuenta_destino: 'caja_mayor',
    }),
  )

  // Movimientos manuales de caja mayor. Un ingreso con origen en otra cuenta
  // es un traspaso (de esa cuenta a caja mayor); externo/ajuste es un ingreso.
  const cajaMayorMovs: CajaMovimiento[] = (cajaMayorRes.data ?? []).map((t) => {
    const monto = Number(t.monto) || 0
    if (t.tipo === 'ingreso') {
      const desde: CuentaCaja | null =
        t.origen === 'caja_efectivo' ? 'efectivo' : t.origen === 'cuenta_digital' ? 'digital' : null
      return sintetizada({
        id: `cm-${t.id}`,
        fecha: t.fecha,
        tipo: 'ingreso',
        categoria: t.categoria ?? (desde ? 'Traspaso a caja mayor' : 'Ingreso a caja mayor'),
        monto,
        descripcion: t.descripcion,
        ref_kind: 'caja_mayor_mov',
        ref_id: t.id,
        created_at: t.created_at,
        bucket: desde ? 'traspaso' : 'ingreso',
        cuenta_origen: desde,
        cuenta_destino: 'caja_mayor',
      })
    }
    return sintetizada({
      id: `cm-${t.id}`,
      fecha: t.fecha,
      tipo: 'egreso',
      categoria: t.categoria ?? 'Egreso de caja mayor',
      monto,
      descripcion: t.descripcion,
      ref_kind: 'caja_mayor_mov',
      ref_id: t.id,
      created_at: t.created_at,
      bucket: 'egreso',
      cuenta_origen: 'caja_mayor',
      cuenta_destino: null,
    })
  })

  // Movimientos del fondo de emergencia. OJO semantica de origen en esta
  // tabla: 'caja_efectivo' significa Caja Mayor (ver fondo-emergencia-card).
  const fondoMovs: CajaMovimiento[] = (fondoRes.data ?? []).map((t) => {
    const monto = Number(t.monto) || 0
    if (t.tipo === 'ingreso') {
      const desde: CuentaCaja | null =
        t.origen === 'caja_efectivo' ? 'caja_mayor' : t.origen === 'cuenta_digital' ? 'digital' : null
      return sintetizada({
        id: `fe-${t.id}`,
        fecha: t.fecha,
        tipo: 'ingreso',
        categoria: t.categoria ?? (desde ? 'Derivado a fondo de emergencia' : 'Ingreso al fondo'),
        monto,
        descripcion: t.descripcion,
        ref_kind: 'fondo_mov',
        ref_id: t.id,
        created_at: t.created_at,
        bucket: desde ? 'traspaso' : 'ingreso',
        cuenta_origen: desde,
        cuenta_destino: 'fondo',
      })
    }
    return sintetizada({
      id: `fe-${t.id}`,
      fecha: t.fecha,
      tipo: 'egreso',
      categoria: t.categoria ?? 'Egreso del fondo',
      monto,
      descripcion: t.descripcion,
      ref_kind: 'fondo_mov',
      ref_id: t.id,
      created_at: t.created_at,
      bucket: 'egreso',
      cuenta_origen: 'fondo',
      cuenta_destino: null,
    })
  })

  // Merge y sort por fecha desc + created_at desc
  const all = [...hydrated, ...traspasos, ...cajaMayorMovs, ...fondoMovs].sort((a, b) => {
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })

  return all
}
