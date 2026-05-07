import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

export type InsumoStock = {
  stock_actual: number | null
  stock_referencia: number | null
  unit: string | null
}

export type InsumoWithProveedor = Tables<'insumos'> & {
  proveedores: Pick<Tables<'proveedores'>, 'id' | 'name'> | null
  stock: InsumoStock | null
}

export async function getInsumos(): Promise<InsumoWithProveedor[]> {
  const supabase = await createClient()

  const [insumosResult, stockResult] = await Promise.all([
    supabase.from('insumos').select('*, proveedores(id, name)').order('name'),
    supabase.from('insumo_stock').select('insumo_id, stock_actual, stock_referencia, unit'),
  ])

  if (insumosResult.error) throw insumosResult.error

  const stockMap = new Map(
    (stockResult.data ?? []).map((s) => [s.insumo_id, s]),
  )

  return (insumosResult.data as unknown as InsumoWithProveedor[]).map((i) => ({
    ...i,
    stock: stockMap.get(i.id) ?? null,
  }))
}

export async function getProveedores(): Promise<Pick<Tables<'proveedores'>, 'id' | 'name'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('proveedores')
    .select('id, name')
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data
}
