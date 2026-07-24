'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { mondayOf } from '@/lib/week'

// Asigna un producto a un (semana, DOW). `week_start` es el lunes de la semana
// ('YYYY-MM-DD'). Si producto_id es null, elimina la asignación de ese día.
// Solo se pueden editar la semana en curso y las futuras — las pasadas son de
// solo lectura (histórico).
export async function setRecetaDelDia(
  week_start: string,
  dow: number,
  producto_id: string | null,
): Promise<{ error?: string }> {
  if (dow < 0 || dow > 6) return { error: 'Día inválido' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week_start)) return { error: 'Semana inválida' }
  if (week_start < mondayOf(new Date())) {
    return { error: 'No se pueden editar semanas pasadas' }
  }
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    if (!producto_id) {
      const { error } = await supabase
        .from('receta_del_dia')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('week_start', week_start)
        .eq('dow', dow)
      if (error) return { error: error.message }
      revalidatePath('/catalogo/receta-del-dia')
      return {}
    }

    // Upsert por (tenant_id, week_start, dow).
    const { error } = await supabase
      .from('receta_del_dia')
      .upsert(
        { tenant_id: tenantId, week_start, dow, producto_id },
        { onConflict: 'tenant_id,week_start,dow' },
      )
    if (error) return { error: error.message }
    revalidatePath('/catalogo/receta-del-dia')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
