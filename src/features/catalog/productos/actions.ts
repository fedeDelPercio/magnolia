'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { ProductoFormValues } from './schemas'

function mapError(msg: string): string {
  if (msg.includes('unique')) return 'Ya existe un producto con ese nombre'
  return msg
}

export async function createProducto(values: ProductoFormValues): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    const { error } = await supabase.from('productos').insert({
      name: values.name,
      sale_price: values.sale_price,
      receta_id: values.receta_id ?? null,
      descartable_cost: values.descartable_cost,
      target_margin_pct: values.target_margin_pct,
      is_dynamic: values.is_dynamic,
      tenant_id: tenantId,
    })

    if (error) return { error: mapError(error.message) }
    revalidatePath('/catalogo/productos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function updateProducto(
  id: string,
  values: ProductoFormValues,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from('productos')
      .update({
        name: values.name,
        sale_price: values.sale_price,
        receta_id: values.receta_id ?? null,
        descartable_cost: values.descartable_cost,
        target_margin_pct: values.target_margin_pct,
        is_dynamic: values.is_dynamic,
      })
      .eq('id', id)

    if (error) return { error: mapError(error.message) }
    revalidatePath('/catalogo/productos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function toggleProductoActive(
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('productos').update({ active }).eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/catalogo/productos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
