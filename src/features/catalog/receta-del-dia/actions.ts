'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

// Asigna un producto a un DOW (0=dom, 6=sab). Si producto_id es null, elimina
// la asignacion (dia sin receta del dia).
export async function setRecetaDelDia(
  dow: number,
  producto_id: string | null,
): Promise<{ error?: string }> {
  if (dow < 0 || dow > 6) return { error: 'DOW invalido' }
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    if (!producto_id) {
      const { error } = await supabase
        .from('receta_del_dia')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('dow', dow)
      if (error) return { error: error.message }
      revalidatePath('/catalogo/receta-del-dia')
      return {}
    }

    // Upsert por (tenant_id, dow). Si ya existe, actualiza; si no, inserta.
    const { error } = await supabase
      .from('receta_del_dia')
      .upsert(
        { tenant_id: tenantId, dow, producto_id },
        { onConflict: 'tenant_id,dow' },
      )
    if (error) return { error: error.message }
    revalidatePath('/catalogo/receta-del-dia')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
