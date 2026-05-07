import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'
import type { IngredienteFormValues } from './schemas'

export type RecetaParaProducto = {
  id: string
  yield_qty: number
  yield_unit: string
  ingredientes: IngredienteFormValues[]
}

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

export type DescartableParaProducto = {
  producto_id: string
  descartables: { insumo_id: string; qty: number }[]
}

export async function getDescartablesParaProductos(): Promise<DescartableParaProducto[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('producto_descartables')
    .select('producto_id, insumo_id, qty')

  if (error) throw error

  const map = new Map<string, { insumo_id: string; qty: number }[]>()
  for (const row of data ?? []) {
    const list = map.get(row.producto_id) ?? []
    list.push({ insumo_id: row.insumo_id, qty: row.qty })
    map.set(row.producto_id, list)
  }

  return Array.from(map.entries()).map(([producto_id, descartables]) => ({
    producto_id,
    descartables,
  }))
}

export async function getRecetasParaProductos(): Promise<RecetaParaProducto[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('recetas')
    .select('id, yield_qty, yield_unit, receta_ingredientes!receta_ingredientes_receta_id_fkey(kind, insumo_id, sub_receta_id, qty, unit)')
    .order('name')

  if (error) throw error

  return (data ?? []).map((r) => ({
    id: r.id,
    yield_qty: r.yield_qty,
    yield_unit: r.yield_unit,
    ingredientes: ((r.receta_ingredientes as unknown as { kind: string; insumo_id: string | null; sub_receta_id: string | null; qty: number; unit: string }[]) ?? []).map((i) => ({
      kind: i.kind as 'insumo' | 'receta',
      insumo_id: i.kind === 'insumo' ? (i.insumo_id ?? undefined) : undefined,
      sub_receta_id: i.kind === 'receta' ? (i.sub_receta_id ?? undefined) : undefined,
      qty: i.qty,
      unit: i.unit as IngredienteFormValues['unit'],
    })),
  }))
}

export async function getInsumosSimple(): Promise<Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'kind'>[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('insumos')
    .select('id, name, unit, kind')
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data
}
