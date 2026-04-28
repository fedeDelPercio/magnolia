import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type DiaOperativo = Tables<'dias_operativos'>

export type MovimientoConProducto = Tables<'movimientos_diarios'> & {
  productos: Pick<Tables<'productos'>, 'name' | 'sale_price'>
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

export async function getDia(diaId: string): Promise<DiaConMovimientos | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('dias_operativos')
    .select(`
      *,
      movimientos_diarios(
        *,
        productos(name, sale_price)
      )
    `)
    .eq('id', diaId)
    .single()

  if (error) return null
  return data as unknown as DiaConMovimientos
}
