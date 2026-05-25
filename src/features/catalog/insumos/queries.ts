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

export type PriceHistoryEntry = Pick<
  Tables<'insumo_price_history'>,
  'id' | 'price' | 'source' | 'valid_from'
> & {
  proveedores: Pick<Tables<'proveedores'>, 'id' | 'name'> | null
}

export async function getInsumoHistory(insumoId: string): Promise<PriceHistoryEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insumo_price_history')
    .select('id, price, source, valid_from, proveedores(id, name)')
    .eq('insumo_id', insumoId)
    .order('valid_from', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as unknown as PriceHistoryEntry[]
}

export type StockAjusteEntry = {
  id: string
  stock_teorico: number
  stock_real: number
  diferencia: number
  notas: string | null
  created_at: string
}

export async function getStockAjustes(insumoId: string): Promise<StockAjusteEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insumo_stock_ajustes')
    .select('id, stock_teorico, stock_real, diferencia, notas, created_at')
    .eq('insumo_id', insumoId)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as StockAjusteEntry[]
}
