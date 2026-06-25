import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

export type CajaMayorMovimiento = {
  id: string
  fecha: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  descripcion: string | null
  source: 'manual' | 'bistro'
  bistro_tx_id: string | null
  origen: 'externo' | 'caja_efectivo' | 'cuenta_digital'
  created_at: string
}

export type CajaMayorSummary = {
  saldo: number                       // saldo total acumulado (todos los tiempos)
  ingresosMes: number                 // ingresos en el mes pedido
  egresosMes: number                  // egresos en el mes pedido
  movimientosMes: CajaMayorMovimiento[]
}

export async function getCajaMayorSummary(month: string): Promise<CajaMayorSummary> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const from = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const nextMonth = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`

  // Saldo acumulado: todos los movimientos hasta el fin del mes (no solo del mes)
  // para reflejar el saldo real al cierre del mes que se esta viendo.
  const [allRes, mesRes] = await Promise.all([
    supabase
      .from('caja_mayor_movimientos')
      .select('tipo, monto')
      .eq('tenant_id', tenantId)
      .lt('fecha', nextMonth),
    supabase
      .from('caja_mayor_movimientos')
      .select('id, fecha, tipo, monto, descripcion, source, bistro_tx_id, origen, created_at')
      .eq('tenant_id', tenantId)
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (allRes.error) throw new Error(allRes.error.message)
  if (mesRes.error) throw new Error(mesRes.error.message)

  let saldo = 0
  for (const m of allRes.data ?? []) {
    const monto = Number(m.monto) || 0
    saldo += m.tipo === 'ingreso' ? monto : -monto
  }

  let ingresosMes = 0
  let egresosMes = 0
  const movimientosMes: CajaMayorMovimiento[] = []
  for (const m of mesRes.data ?? []) {
    const monto = Number(m.monto) || 0
    if (m.tipo === 'ingreso') ingresosMes += monto
    else egresosMes += monto
    movimientosMes.push({
      id: m.id,
      fecha: m.fecha,
      tipo: m.tipo as 'ingreso' | 'egreso',
      monto,
      descripcion: m.descripcion,
      source: m.source as 'manual' | 'bistro',
      bistro_tx_id: m.bistro_tx_id,
      origen: (m.origen ?? 'externo') as 'externo' | 'caja_efectivo' | 'cuenta_digital',
      created_at: m.created_at,
    })
  }

  return { saldo, ingresosMes, egresosMes, movimientosMes }
}

// Ultimo cierre de caja registrado en Bistro (independiente del mes filtrado
// en /caja, queremos mostrar SIEMPRE el ultimo dato real disponible).
export type UltimoCierre = {
  fecha: string
  monto: number
} | null

export async function getUltimoCierreCaja(): Promise<UltimoCierre> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('bistro_transacciones')
    .select('fecha_local, amount_total')
    .eq('tenant_id', tenantId)
    .eq('transaction_type', 'CIERRE DE CAJA')
    .order('fecha_hora', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return {
    fecha: data.fecha_local ?? '',
    monto: Number(data.amount_total) || 0,
  }
}
