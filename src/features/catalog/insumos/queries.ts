import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

export type InsumoWithProveedor = Tables<'insumos'> & {
  proveedores: Pick<Tables<'proveedores'>, 'id' | 'name'> | null
}

export async function getInsumos(): Promise<InsumoWithProveedor[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insumos')
    .select('*, proveedores(id, name)')
    .order('name')

  if (error) throw error
  return data as InsumoWithProveedor[]
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
