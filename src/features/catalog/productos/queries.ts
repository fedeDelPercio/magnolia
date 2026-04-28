import { createClient } from '@/lib/supabase/server'
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
