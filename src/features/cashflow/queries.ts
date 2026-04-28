import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type CajaMovimiento = Tables<'caja_movimientos'>

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
  return data ?? []
}
