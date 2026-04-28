'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { InsumoFormValues } from './schemas'

function mapError(msg: string): string {
  if (msg.includes('unique')) return 'Ya existe un insumo con ese nombre'
  return msg
}

export async function createInsumo(values: InsumoFormValues): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    const { error } = await supabase.from('insumos').insert({
      name: values.name,
      unit: values.unit,
      current_price: values.current_price,
      proveedor_id: values.proveedor_id ?? null,
      perishable: values.perishable,
      shelf_life_days: values.perishable ? (values.shelf_life_days ?? null) : null,
      tenant_id: tenantId,
    })

    if (error) return { error: mapError(error.message) }
    revalidatePath('/catalogo/insumos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function updateInsumo(
  id: string,
  values: InsumoFormValues,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('insumos')
      .update({
        name: values.name,
        unit: values.unit,
        current_price: values.current_price,
        proveedor_id: values.proveedor_id ?? null,
        perishable: values.perishable,
        shelf_life_days: values.perishable ? (values.shelf_life_days ?? null) : null,
      })
      .eq('id', id)

    if (error) return { error: mapError(error.message) }
    revalidatePath('/catalogo/insumos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function toggleInsumoActive(
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('insumos').update({ active }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/catalogo/insumos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
