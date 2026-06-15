import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { ComprobanteItem, InsumoMatch, ItemConMatch } from './schemas'

// Para cada item detectado por la IA, busca los 3 insumos más similares del
// tenant via pg_trgm. La RPC `match_insumos_by_name` filtra por threshold 0.2
// para no devolver matches ruidosos. Si el top score >= 0.5 lo pre-seleccionamos
// como sugerencia primaria; debajo de eso, el user decide manualmente.
export async function matchItemsConInsumos(items: ComprobanteItem[]): Promise<ItemConMatch[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const results = await Promise.all(
    items.map(async (item): Promise<ItemConMatch> => {
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

      return { detected: item, candidates, suggested_insumo_id }
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
    .select('id, name, unit, current_price, purchase_unit_label, purchase_unit_factor')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}
