import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Database, Tables } from '@/types/database'

// Bucket categoriza el movimiento para la UI:
// - 'ingreso'/'egreso': flujo real de caja (afecta totales del mes).
// - 'traspaso': el POS movio efectivo a la caja fuerte (RETIRO POR CIERRE).
//   No es un egreso "real", solo cambia de bolsillo. NO afecta totales.
// - 'ganancia_duenos': retiro de ganancia (OTROS - RCA). Es un egreso real
//   pero conceptualmente distinto — sale del sistema, no vuelve.
export type CajaMovimientoBucket = 'ingreso' | 'egreso' | 'traspaso' | 'ganancia_duenos'

// Extendemos el row con info del pago referenciado (cuando ref_kind='pago_proveedor')
// para poder distinguir cheque vs efectivo/transferencia en la grilla. Sólo afecta
// movimientos creados por pagos a proveedor; el resto queda con metodo=null.
export type CajaMovimiento = Tables<'caja_movimientos'> & {
  metodo: Database['public']['Enums']['pago_metodo'] | null
  due_date: string | null
  cleared_at: string | null
  empleado_name: string | null
  bucket: CajaMovimientoBucket
}

export async function getCajaMovimientos(month: string): Promise<CajaMovimiento[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const from = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year! + 1}-01-01` : `${year}-${String(mon! + 1).padStart(2, '0')}-01`

  const [{ data, error }, traspasosRes] = await Promise.all([
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

  const hydrated: CajaMovimiento[] = rows.map((m) => {
    const hit = m.ref_kind === 'pago_proveedor' && m.ref_id ? pagosMap.get(m.ref_id) : null
    const empName =
      m.ref_kind === 'liquidacion_empleado' && m.ref_id ? empNameMap.get(m.ref_id) ?? null : null
    // Bucket para la UI: RCA (bistro_tx + categoria='Ganancia dueños') tiene
    // tratamiento visual distinto que un egreso comun.
    const isGanancia =
      m.ref_kind === 'bistro_tx' && m.categoria === 'Ganancia dueños'
    const bucket: CajaMovimientoBucket = isGanancia
      ? 'ganancia_duenos'
      : (m.tipo as 'ingreso' | 'egreso')
    return {
      ...m,
      metodo: hit?.metodo ?? null,
      due_date: hit?.due_date ?? null,
      cleared_at: hit?.cleared_at ?? null,
      empleado_name: empName,
      bucket,
    }
  })

  // Sumar los traspasos POS -> caja fuerte como items informativos. Se sintetizan
  // como filas del mismo tipo CajaMovimiento con bucket='traspaso' — la UI las
  // muestra con icono/color propios y NO cuentan para ingreso/egreso del mes.
  const traspasos: CajaMovimiento[] = (traspasosRes.data ?? []).map((t) => ({
    id: `traspaso-${t.id}`,
    tenant_id: tenantId,
    fecha: t.fecha,
    tipo: 'egreso',
    categoria: 'Traspaso a caja fuerte',
    monto: Number(t.monto) || 0,
    descripcion: t.descripcion ?? 'Retiro por cierre (Bistro)',
    ref_kind: 'caja_mayor_traspaso',
    ref_id: t.id,
    created_at: t.created_at,
    updated_at: t.created_at,
    metodo: null,
    due_date: null,
    cleared_at: null,
    empleado_name: null,
    bucket: 'traspaso',
  }))

  // Merge y sort por fecha desc + created_at desc
  const all = [...hydrated, ...traspasos].sort((a, b) => {
    if (a.fecha !== b.fecha) return b.fecha.localeCompare(a.fecha)
    return (b.created_at ?? '').localeCompare(a.created_at ?? '')
  })

  return all
}
