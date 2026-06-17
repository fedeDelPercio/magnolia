import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables } from '@/types/database'

// Item de compra "tal como lo ingresa el user" — puede apuntar a un insumo padre
// que se despieza. La expansion convierte ese item en N items de los hijos.
export type CompraItemInput = {
  insumo_id: string
  qty: number
  unit: Tables<'insumos'>['unit']
  unit_price: number
}

// Para un set de insumos involucrados en una compra, trae las filas de
// despiece + la unidad de cada hijo. Devuelve un map parent_id -> hijos[].
async function fetchDespiecesFor(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  parentIds: string[],
): Promise<Map<string, Array<{ hijo_id: string; qty_por_unidad: number; hijo_unit: Tables<'insumos'>['unit'] }>>> {
  if (parentIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('insumo_despiece')
    .select('parent_id, hijo_id, qty_por_unidad, hijo:insumos!insumo_despiece_hijo_id_fkey(unit)')
    .eq('tenant_id', tenantId)
    .in('parent_id', parentIds)
  if (error || !data) return new Map()

  const map = new Map<string, Array<{ hijo_id: string; qty_por_unidad: number; hijo_unit: Tables<'insumos'>['unit'] }>>()
  for (const row of data as unknown as Array<{
    parent_id: string
    hijo_id: string
    qty_por_unidad: number
    hijo: { unit: Tables<'insumos'>['unit'] } | null
  }>) {
    const arr = map.get(row.parent_id) ?? []
    arr.push({
      hijo_id: row.hijo_id,
      qty_por_unidad: Number(row.qty_por_unidad),
      hijo_unit: row.hijo?.unit ?? 'u',
    })
    map.set(row.parent_id, arr)
  }
  return map
}

// Toma los items "como vienen del form" y expande los padres con despiece a
// items por hijo. Items sin despiece pasan iguales. El costo unitario del
// hijo es proporcional a la qty_por_unidad sobre el total del despiece.
//
// Ejemplo: 2 cajones a $40.000 c/u con despiece {pechuga:12, pata:12} →
//   2*12 = 24 pechugas y 24 patas. Total del cajon = $80.000. Total de
//   unidades generadas = 48. unit_price hijo = $80.000 / 48 = $1.666,67.
//
// Pero como ambos hijos comparten el mismo "$ por unidad" en este modelo
// simple, lo calculamos por compra (no agregado): unit_price hijo i =
// unit_price_padre / sum(qty_por_unidad de todos los hijos).
export async function expandDespiece(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  items: CompraItemInput[],
): Promise<CompraItemInput[]> {
  const parentIds = Array.from(new Set(items.map((i) => i.insumo_id)))
  const despieces = await fetchDespiecesFor(supabase, tenantId, parentIds)

  const expanded: CompraItemInput[] = []
  for (const item of items) {
    const hijos = despieces.get(item.insumo_id)
    if (!hijos || hijos.length === 0) {
      expanded.push(item)
      continue
    }
    const sumQty = hijos.reduce((s, h) => s + h.qty_por_unidad, 0)
    if (sumQty <= 0) {
      expanded.push(item)
      continue
    }
    const unitPriceHijo = item.unit_price / sumQty
    for (const h of hijos) {
      expanded.push({
        insumo_id: h.hijo_id,
        qty: item.qty * h.qty_por_unidad,
        unit: h.hijo_unit,
        unit_price: unitPriceHijo,
      })
    }
  }
  return expanded
}

// Indica para cada item si tiene despiece configurado. Lo usa la UI de preview.
export async function checkDespieceParents(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  insumoIds: string[],
): Promise<Map<string, Array<{ hijo_id: string; hijo_name: string; qty_por_unidad: number; hijo_unit: string }>>> {
  if (insumoIds.length === 0) return new Map()
  const { data } = await supabase
    .from('insumo_despiece')
    .select('parent_id, hijo_id, qty_por_unidad, hijo:insumos!insumo_despiece_hijo_id_fkey(name, unit)')
    .eq('tenant_id', tenantId)
    .in('parent_id', insumoIds)

  const map = new Map<string, Array<{ hijo_id: string; hijo_name: string; qty_por_unidad: number; hijo_unit: string }>>()
  for (const row of (data ?? []) as unknown as Array<{
    parent_id: string
    hijo_id: string
    qty_por_unidad: number
    hijo: { name: string; unit: string } | null
  }>) {
    const arr = map.get(row.parent_id) ?? []
    arr.push({
      hijo_id: row.hijo_id,
      hijo_name: row.hijo?.name ?? '',
      qty_por_unidad: Number(row.qty_por_unidad),
      hijo_unit: row.hijo?.unit ?? '',
    })
    map.set(row.parent_id, arr)
  }
  return map
}
