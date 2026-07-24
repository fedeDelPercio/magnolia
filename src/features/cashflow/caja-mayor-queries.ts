import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

export type CajaMayorMovimiento = {
  id: string
  fecha: string
  tipo: 'ingreso' | 'egreso'
  monto: number
  descripcion: string | null
  categoria: string | null
  // 'traspaso_fondo' = egreso sintetizado: plata que se derivo al fondo de
  // emergencia. Vive en fondo_emergencia_movimientos, no se borra desde aca.
  source: 'manual' | 'bistro' | 'traspaso_fondo'
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
  // Ademas restamos los traspasos a fondo de emergencia que salieron de caja
  // mayor (fondo_emergencia_movimientos ingreso, origen='caja_efectivo').
  const [allRes, mesRes, fondoAllRes, fondoMesRes] = await Promise.all([
    supabase
      .from('caja_mayor_movimientos')
      .select('tipo, monto')
      .eq('tenant_id', tenantId)
      .lt('fecha', nextMonth),
    supabase
      .from('caja_mayor_movimientos')
      .select('id, fecha, tipo, monto, descripcion, categoria, source, bistro_tx_id, origen, created_at')
      .eq('tenant_id', tenantId)
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('fondo_emergencia_movimientos')
      .select('monto')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'ingreso')
      .eq('origen', 'caja_efectivo')
      .lt('fecha', nextMonth),
    supabase
      .from('fondo_emergencia_movimientos')
      .select('id, fecha, monto, descripcion, categoria, created_at')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'ingreso')
      .eq('origen', 'caja_efectivo')
      .gte('fecha', from)
      .lt('fecha', nextMonth)
      .order('fecha', { ascending: false }),
  ])

  if (allRes.error) throw new Error(allRes.error.message)
  if (mesRes.error) throw new Error(mesRes.error.message)
  if (fondoAllRes.error) throw new Error(fondoAllRes.error.message)
  if (fondoMesRes.error) throw new Error(fondoMesRes.error.message)

  let saldo = 0
  for (const m of allRes.data ?? []) {
    const monto = Number(m.monto) || 0
    saldo += m.tipo === 'ingreso' ? monto : -monto
  }
  // Los traspasos a fondo salen de caja mayor -> restan al saldo.
  for (const f of fondoAllRes.data ?? []) saldo -= Number(f.monto) || 0

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
      categoria: m.categoria ?? null,
      source: m.source as 'manual' | 'bistro',
      bistro_tx_id: m.bistro_tx_id,
      origen: (m.origen ?? 'externo') as 'externo' | 'caja_efectivo' | 'cuenta_digital',
      created_at: m.created_at,
    })
  }
  // Traspasos a fondo de emergencia como egresos sintetizados (no borrables aca).
  for (const f of fondoMesRes.data ?? []) {
    const monto = Number(f.monto) || 0
    egresosMes += monto
    movimientosMes.push({
      id: `fondo-${f.id}`,
      fecha: f.fecha,
      tipo: 'egreso',
      monto,
      descripcion: f.descripcion ?? 'Derivado a fondo de emergencia',
      categoria: f.categoria ?? 'Fondo de emergencia',
      source: 'traspaso_fondo',
      bistro_tx_id: null,
      origen: 'externo',
      created_at: f.created_at,
    })
  }
  movimientosMes.sort((a, b) => b.fecha.localeCompare(a.fecha))

  return { saldo, ingresosMes, egresosMes, movimientosMes }
}

// Categorias disponibles para egresos de caja/caja mayor. Se usa como fuente
// del dropdown en los modales.
export async function getCajaCategorias(): Promise<string[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data, error } = await supabase
    .from('caja_categorias')
    .select('name')
    .eq('tenant_id', tenantId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []).map((c) => c.name)
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
