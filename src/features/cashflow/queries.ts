import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Database, Tables } from '@/types/database'

// Extendemos el row con info del pago referenciado (cuando ref_kind='pago_proveedor')
// para poder distinguir cheque vs efectivo/transferencia en la grilla. Sólo afecta
// movimientos creados por pagos a proveedor; el resto queda con metodo=null.
export type CajaMovimiento = Tables<'caja_movimientos'> & {
  metodo: Database['public']['Enums']['pago_metodo'] | null
  due_date: string | null
  cleared_at: string | null
  empleado_name: string | null
}

export async function getCajaMovimientos(month: string): Promise<CajaMovimiento[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const from = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year! + 1}-01-01` : `${year}-${String(mon! + 1).padStart(2, '0')}-01`

  const { data, error } = await supabase
    .from('caja_movimientos')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('fecha', from)
    .lt('fecha', nextMonth)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })

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

  return rows.map((m) => {
    const hit = m.ref_kind === 'pago_proveedor' && m.ref_id ? pagosMap.get(m.ref_id) : null
    const empName =
      m.ref_kind === 'liquidacion_empleado' && m.ref_id ? empNameMap.get(m.ref_id) ?? null : null
    return {
      ...m,
      metodo: hit?.metodo ?? null,
      due_date: hit?.due_date ?? null,
      cleared_at: hit?.cleared_at ?? null,
      empleado_name: empName,
    }
  })
}
