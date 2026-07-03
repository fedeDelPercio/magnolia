import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'

export type ProductoCost = NonNullable<Tables<'product_costs'>>

export async function getProductos(): Promise<ProductoCost[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('product_costs')
    .select('*')
    .order('name')

  if (error) throw error
  return (data ?? []) as ProductoCost[]
}

export type ConceptoBasico = { id: string; name: string }

export async function getConceptos(): Promise<ConceptoBasico[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data, error } = await supabase
    .from('producto_conceptos')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .order('name')
  if (error) throw error
  return (data ?? []) as ConceptoBasico[]
}

export type ProductoPriceHistoryEntry = {
  id: string
  sale_price: number
  total_cost: number | null
  margin_pct: number | null
  valid_from: string
}

export async function getProductoPriceHistory(productoId: string): Promise<ProductoPriceHistoryEntry[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('producto_price_history')
    .select('id, sale_price, total_cost, margin_pct, valid_from')
    .eq('producto_id', productoId)
    .order('valid_from', { ascending: false })
    .limit(30)
  if (error) throw error
  return (data ?? []) as ProductoPriceHistoryEntry[]
}
