'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { RecetaFormValues } from './schemas'

function mapError(msg: string): string {
  if (msg.includes('unique')) return 'Ya existe una receta con ese nombre'
  if (msg.includes('Ciclo detectado')) return msg
  return msg
}

export async function createReceta(values: RecetaFormValues): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    const { data: receta, error: recetaErr } = await supabase
      .from('recetas')
      .insert({
        name: values.name,
        category: values.category || null,
        yield_qty: values.yield_qty,
        yield_unit: values.yield_unit,
        notes: values.notes || null,
        tenant_id: tenantId,
      })
      .select('id')
      .single()

    if (recetaErr) return { error: mapError(recetaErr.message) }

    if (values.ingredientes.length > 0) {
      const { error: ingErr } = await supabase.from('receta_ingredientes').insert(
        values.ingredientes.map((i) => ({
          receta_id: receta.id,
          kind: i.kind,
          insumo_id: i.kind === 'insumo' ? (i.insumo_id ?? null) : null,
          sub_receta_id: i.kind === 'receta' ? (i.sub_receta_id ?? null) : null,
          qty: i.qty,
          unit: i.unit,
        })),
      )
      if (ingErr) return { error: mapError(ingErr.message) }
    }

    revalidatePath('/catalogo/recetas')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function updateReceta(
  id: string,
  values: RecetaFormValues,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()

    const { error: recetaErr } = await supabase
      .from('recetas')
      .update({
        name: values.name,
        category: values.category || null,
        yield_qty: values.yield_qty,
        yield_unit: values.yield_unit,
        notes: values.notes || null,
      })
      .eq('id', id)

    if (recetaErr) return { error: mapError(recetaErr.message) }

    // Replace ingredients: delete then re-insert
    const { error: delErr } = await supabase
      .from('receta_ingredientes')
      .delete()
      .eq('receta_id', id)

    if (delErr) return { error: delErr.message }

    if (values.ingredientes.length > 0) {
      const { error: ingErr } = await supabase.from('receta_ingredientes').insert(
        values.ingredientes.map((i) => ({
          receta_id: id,
          kind: i.kind,
          insumo_id: i.kind === 'insumo' ? (i.insumo_id ?? null) : null,
          sub_receta_id: i.kind === 'receta' ? (i.sub_receta_id ?? null) : null,
          qty: i.qty,
          unit: i.unit,
        })),
      )
      if (ingErr) return { error: mapError(ingErr.message) }
    }

    revalidatePath('/catalogo/recetas')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function toggleRecetaActive(
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('recetas').update({ active }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/catalogo/recetas')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
