import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

export type RecetaWithIngredientes = Tables<'recetas'> & {
  receta_ingredientes: (Tables<'receta_ingredientes'> & {
    insumos: Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'> | null
    recetas: Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit'> | null
  })[]
}

export async function getRecetas(): Promise<RecetaWithIngredientes[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recetas')
    .select(
      `
      *,
      receta_ingredientes!receta_ingredientes_receta_id_fkey(
        *,
        insumos(id, name, unit),
        recetas!receta_ingredientes_sub_receta_id_fkey(id, name, yield_unit)
      )
    `,
    )
    .order('name')

  if (error) throw error
  return data as unknown as RecetaWithIngredientes[]
}

export async function getRecetasSimple(): Promise<Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recetas')
    .select('id, name, yield_unit, yield_qty')
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data
}

export async function getInsumosSimple(): Promise<Pick<Tables<'insumos'>, 'id' | 'name' | 'unit'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insumos')
    .select('id, name, unit')
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data
}
