import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { Tables } from '@/types/database'
import type { IngredienteFormValues } from './schemas'

// IMPORTANTE: todos los listados filtran por tenant ACTIVO explícitamente.
// RLS sola no alcanza: un usuario miembro de varios tenants ve las filas de
// todos, y estas listas alimentan selectores — una receta de otro tenant
// aparece pero después no se puede vincular (RLS bloquea el cruce al guardar).

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
  // total_cost sale de la vista receta_costs (recipe_cost pre-computado).
  // Es opcional para no romper otros consumidores del tipo.
  total_cost?: number
}

export async function getRecetas(): Promise<RecetaWithIngredientes[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  // Traemos todas las recetas + los ids que estan siendo usados como (a) receta
  // 1:1 de un producto y (b) sub-receta dentro de otra. Con eso filtramos las
  // que solo existen como backing de un producto — para el usuario esas son
  // productos, no sub-recetas, y ya aparecen en /catalogo/productos.
  const [allRes, prodRes, subRes, costsRes] = await Promise.all([
    supabase
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
      .eq('tenant_id', tenantId)
      .order('name'),
    supabase.from('productos').select('receta_id').eq('tenant_id', tenantId).not('receta_id', 'is', null),
    supabase
      .from('receta_ingredientes')
      .select('sub_receta_id, recetas!receta_ingredientes_receta_id_fkey!inner(tenant_id)')
      .eq('recetas.tenant_id', tenantId)
      .not('sub_receta_id', 'is', null),
    supabase.from('receta_costs').select('id, total_cost').eq('tenant_id', tenantId),
  ])

  if (allRes.error) throw allRes.error

  const usadaComoProducto = new Set(
    (prodRes.data ?? []).map((r) => r.receta_id).filter((v): v is string => !!v),
  )
  const usadaComoSub = new Set(
    (subRes.data ?? []).map((r) => r.sub_receta_id).filter((v): v is string => !!v),
  )
  const costMap = new Map(
    (costsRes.data ?? []).map((r) => [r.id, Number(r.total_cost ?? 0)]),
  )

  // Mostrar solo si: (a) se usa como sub-receta (aunque tambien sea producto), o
  // (b) no se usa como producto (incluye huerfanas). Excluye las que solo son
  // backing 1:1 de un producto.
  const filtered = (allRes.data as unknown as RecetaWithIngredientes[])
    .filter((r) => {
      if (usadaComoSub.has(r.id)) return true
      if (!usadaComoProducto.has(r.id)) return true
      return false
    })
    .map((r) => ({ ...r, total_cost: costMap.get(r.id) ?? 0 }))

  return filtered
}

export type RecetaSimpleConCosto = Pick<Tables<'recetas'>, 'id' | 'name' | 'yield_unit' | 'yield_qty'> & {
  total_cost: number
}

export async function getRecetasSimple(): Promise<RecetaSimpleConCosto[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  // Traemos total_cost desde la vista receta_costs (migracion 0053) que
  // computa recipe_cost() por receta. Asi el ingredientes-editor puede
  // mostrar el costo real de cada sub-receta al usarla en un producto.
  const { data, error } = await supabase
    .from('receta_costs')
    .select('id, name, yield_unit, yield_qty, total_cost')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id!,
    name: r.name!,
    yield_unit: r.yield_unit!,
    yield_qty: r.yield_qty!,
    total_cost: Number(r.total_cost ?? 0),
  }))
}

export type DescartableParaProducto = {
  producto_id: string
  descartables: { insumo_id: string; qty: number }[]
}

export async function getDescartablesParaProductos(): Promise<DescartableParaProducto[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  // producto_descartables no tiene tenant_id propio: filtramos via el producto.
  const { data, error } = await supabase
    .from('producto_descartables')
    .select('producto_id, insumo_id, qty, productos!inner(tenant_id)')
    .eq('productos.tenant_id', tenantId)

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
  const tenantId = await getActiveTenantId()
  const { data, error } = await supabase
    .from('recetas')
    .select('id, yield_qty, yield_unit, receta_ingredientes!receta_ingredientes_receta_id_fkey(kind, insumo_id, sub_receta_id, qty, unit)')
    .eq('tenant_id', tenantId)
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

export async function getInsumosSimple(): Promise<Pick<Tables<'insumos'>, 'id' | 'name' | 'unit' | 'kind' | 'current_price'>[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data, error } = await supabase
    .from('insumos')
    .select('id, name, unit, kind, current_price')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')

  if (error) throw error
  return data
}
