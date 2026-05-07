'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { ProductoFormValues } from './schemas'

function mapError(msg: string): string {
  if (msg.includes('unique')) return 'Ya existe un producto con ese nombre'
  if (msg.includes('Ciclo detectado')) return msg
  return msg
}

function buildIngredientesRows(recetaId: string, values: ProductoFormValues) {
  return values.ingredientes.map((i) => ({
    receta_id: recetaId,
    kind: i.kind,
    insumo_id: i.kind === 'insumo' ? (i.insumo_id ?? null) : null,
    sub_receta_id: i.kind === 'receta' ? (i.sub_receta_id ?? null) : null,
    qty: i.qty,
    unit: i.unit,
  }))
}

async function syncDescartables(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  productoId: string,
  values: ProductoFormValues,
) {
  await supabase.from('producto_descartables').delete().eq('producto_id', productoId)
  if (values.descartables.length > 0) {
    const { error } = await supabase.from('producto_descartables').insert(
      values.descartables.map((d) => ({
        producto_id: productoId,
        insumo_id: d.insumo_id,
        qty: d.qty,
      })),
    )
    if (error) return error.message
  }
  return null
}

export async function createProducto(values: ProductoFormValues): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    // 1. Crear la receta vinculada
    const { data: receta, error: recetaErr } = await supabase
      .from('recetas')
      .insert({
        name: values.name,
        yield_qty: values.yield_qty,
        yield_unit: values.yield_unit,
        tenant_id: tenantId,
      })
      .select('id')
      .single()

    if (recetaErr) return { error: mapError(recetaErr.message) }

    // 2. Insertar ingredientes
    if (values.ingredientes.length > 0) {
      const { error: ingErr } = await supabase
        .from('receta_ingredientes')
        .insert(buildIngredientesRows(receta.id, values))
      if (ingErr) {
        await supabase.from('recetas').delete().eq('id', receta.id)
        return { error: mapError(ingErr.message) }
      }
    }

    // 3. Crear el producto apuntando a la receta
    const { data: producto, error } = await supabase.from('productos').insert({
      name: values.name,
      sale_price: values.sale_price,
      receta_id: receta.id,
      target_margin_pct: values.target_margin_pct,
      is_dynamic: values.is_dynamic,
      tenant_id: tenantId,
    }).select('id').single()

    if (error) {
      await supabase.from('recetas').delete().eq('id', receta.id)
      return { error: mapError(error.message) }
    }

    // 4. Sincronizar descartables
    const descErr = await syncDescartables(supabase, producto.id, values)
    if (descErr) return { error: descErr }

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
    const tenantId = await getActiveTenantId()

    let recetaId = values.receta_id ?? null

    if (!recetaId) {
      // Producto sin receta previa (caso legacy): crear una
      const { data: receta, error: recetaErr } = await supabase
        .from('recetas')
        .insert({
          name: values.name,
          yield_qty: values.yield_qty,
          yield_unit: values.yield_unit,
          tenant_id: tenantId,
        })
        .select('id')
        .single()
      if (recetaErr) return { error: recetaErr.message }
      recetaId = receta.id
    } else {
      // Actualizar la receta existente
      const { error: recetaErr } = await supabase
        .from('recetas')
        .update({
          name: values.name,
          yield_qty: values.yield_qty,
          yield_unit: values.yield_unit,
        })
        .eq('id', recetaId)
      if (recetaErr) return { error: recetaErr.message }

      // Reemplazar ingredientes: delete + re-insert
      const { error: delErr } = await supabase
        .from('receta_ingredientes')
        .delete()
        .eq('receta_id', recetaId)
      if (delErr) return { error: delErr.message }
    }

    if (values.ingredientes.length > 0) {
      const { error: ingErr } = await supabase
        .from('receta_ingredientes')
        .insert(buildIngredientesRows(recetaId, values))
      if (ingErr) return { error: mapError(ingErr.message) }
    }

    const { error } = await supabase
      .from('productos')
      .update({
        name: values.name,
        sale_price: values.sale_price,
        receta_id: recetaId,
        target_margin_pct: values.target_margin_pct,
        is_dynamic: values.is_dynamic,
      })
      .eq('id', id)

    if (error) return { error: mapError(error.message) }

    // Sincronizar descartables
    const descErr = await syncDescartables(supabase, id, values)
    if (descErr) return { error: descErr }

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
