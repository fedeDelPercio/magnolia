import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

export type FondoEmergenciaMovimiento = {
  id: string
  fecha: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  descripcion: string | null
  categoria: string | null
  origen: 'externo' | 'caja_efectivo' | 'cuenta_digital'
  created_at: string
}

export type FondoEmergenciaSummary = {
  saldo: number                          // saldo total acumulado (todos los tiempos)
  ingresosMes: number                    // ingresos en el mes pedido
  egresosMes: number                     // egresos en el mes pedido
  movimientosMes: FondoEmergenciaMovimiento[]
}

// Saldo del fondo = suma de su tabla (ingresos +, egresos −), acumulado hasta
// el fin del mes seleccionado. Los traspasos desde caja mayor / digital entran
// como ingresos con `origen` != 'externo' (esas cuentas los restan de su lado).
export async function getFondoEmergenciaSummary(month: string): Promise<FondoEmergenciaSummary> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const from = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const nextMonth = m === 12 ? `${y! + 1}-01-01` : `${y}-${String(m! + 1).padStart(2, '0')}-01`

  const [allRes, mesRes] = await Promise.all([
    supabase
      .from('fondo_emergencia_movimientos')
      .select('tipo, monto')
      .eq('tenant_id', tenantId)
      .lt('fecha', nextMonth),
    supabase
      .from('fondo_emergencia_movimientos')
      .select('id, fecha, tipo, monto, descripcion, categoria, origen, created_at')
      .eq('tenant_id', tenantId)
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (allRes.error) throw new Error(allRes.error.message)
  if (mesRes.error) throw new Error(mesRes.error.message)

  let saldo = 0
  for (const r of allRes.data ?? []) {
    const monto = Number(r.monto) || 0
    saldo += r.tipo === 'ingreso' ? monto : -monto
  }

  let ingresosMes = 0
  let egresosMes = 0
  const movimientosMes: FondoEmergenciaMovimiento[] = []
  for (const r of mesRes.data ?? []) {
    const monto = Number(r.monto) || 0
    if (r.tipo === 'ingreso') ingresosMes += monto
    else egresosMes += monto
    movimientosMes.push({
      id: r.id,
      fecha: r.fecha,
      tipo: r.tipo as 'ingreso' | 'egreso',
      monto,
      descripcion: r.descripcion,
      categoria: r.categoria ?? null,
      origen: (r.origen ?? 'externo') as 'externo' | 'caja_efectivo' | 'cuenta_digital',
      created_at: r.created_at,
    })
  }

  return { saldo, ingresosMes, egresosMes, movimientosMes }
}
