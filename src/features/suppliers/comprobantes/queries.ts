import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { normalizeAliasText } from './normalize'
import type { ComprobanteItem, InsumoMatch, ItemConMatch } from './schemas'

// Match de items detectados por la IA contra insumos del tenant. La prioridad
// es:
//   1) insumo_aliases (memoria de matches confirmados antes para este proveedor).
//      Si el texto normalizado del item ya fue asociado a un insumo, se
//      auto-selecciona ese — el user no tiene que volver a sincronizar.
//   2) fuzzy match por pg_trgm contra el catalogo. Pre-selecciona el top si
//      score >= 0.5, sino el user decide manualmente.
export async function matchItemsConInsumos(
  items: ComprobanteItem[],
  proveedorId: string,
): Promise<ItemConMatch[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  // 1) Lookup batch en insumo_aliases
  const normalizedByItem = items.map((it) => normalizeAliasText(it.nombre))
  const uniqueNormalized = Array.from(new Set(normalizedByItem.filter(Boolean)))
  const aliasMap = new Map<string, { insumo_id: string; name: string; unit: string }>()
  if (uniqueNormalized.length > 0) {
    const { data: aliasRows } = await supabase
      .from('insumo_aliases')
      .select('raw_text_normalized, insumo_id, insumos!inner(id, name, unit, active)')
      .eq('tenant_id', tenantId)
      .eq('proveedor_id', proveedorId)
      .in('raw_text_normalized', uniqueNormalized)
    for (const row of aliasRows ?? []) {
      const insumo = row.insumos as unknown as { id: string; name: string; unit: string; active: boolean }
      if (!insumo?.active) continue
      aliasMap.set(row.raw_text_normalized, {
        insumo_id: insumo.id,
        name: insumo.name,
        unit: insumo.unit,
      })
    }
  }

  // 2) Fuzzy fallback para los que no tienen alias
  const results = await Promise.all(
    items.map(async (item, idx): Promise<ItemConMatch> => {
      const normalized = normalizedByItem[idx]!
      const alias = aliasMap.get(normalized)
      if (alias) {
        const aliasCandidate: InsumoMatch = {
          insumo_id: alias.insumo_id,
          name: alias.name,
          unit: alias.unit,
          score: 1,
        }
        return {
          detected: item,
          candidates: [aliasCandidate],
          suggested_insumo_id: alias.insumo_id,
          match_source: 'alias',
        }
      }

      const { data } = await supabase.rpc('match_insumos_by_name', {
        p_tenant_id: tenantId,
        p_query: item.nombre,
        p_limit: 3,
        p_threshold: 0.2,
      })

      const candidates: InsumoMatch[] = (data ?? []).map((row) => ({
        insumo_id: row.insumo_id,
        name: row.name,
        unit: row.unit,
        score: Number(row.score),
      }))

      const top = candidates[0]
      const suggested_insumo_id = top && top.score >= 0.5 ? top.insumo_id : null

      return {
        detected: item,
        candidates,
        suggested_insumo_id,
        match_source: suggested_insumo_id ? 'fuzzy' : null,
      }
    }),
  )

  return results
}

// Lista insumos del tenant para el combobox de "asignar a otro insumo" en la UI
// de revisión del comprobante.
export async function listInsumosForComprobante() {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data, error } = await supabase
    .from('insumos')
    .select('id, name, unit, current_price, purchase_unit_label, purchase_unit_factor, track_stock')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}
