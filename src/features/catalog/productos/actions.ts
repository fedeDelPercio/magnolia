'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { ProductoFormValues } from './schemas'
import type { ProductoPriceHistoryEntry } from './queries'

function mapError(msg: string): string {
  if (msg.includes('idx_productos_variante_unica'))
    return 'Ya existe una variante de ese concepto con la misma combinacion (canal + formato)'
  if (msg.includes('unique')) return 'Ya existe un producto con ese nombre'
  if (msg.includes('Ciclo detectado')) return msg
  return msg
}

// Resuelve concepto_name a concepto_id: si existe uno con el mismo nombre
// (case-insensitive), lo devuelve; si no, lo crea. Un nombre en blanco o null
// se traduce a null (producto standalone, sin concepto).
async function resolveConceptoId(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  tenantId: string,
  conceptoName: string | null | undefined,
): Promise<{ id: string | null; error?: string }> {
  const name = conceptoName?.trim()
  if (!name) return { id: null }
  const { data: existing, error: findErr } = await supabase
    .from('producto_conceptos')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('name', name)
    .maybeSingle()
  if (findErr) return { id: null, error: findErr.message }
  if (existing) return { id: existing.id }
  const { data: created, error: createErr } = await supabase
    .from('producto_conceptos')
    .insert({ tenant_id: tenantId, name })
    .select('id')
    .single()
  if (createErr) return { id: null, error: createErr.message }
  return { id: created.id }
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

async function snapshotPriceHistory(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  productoId: string,
  tenantId: string,
  userId: string | null,
) {
  const { data: costs } = await supabase
    .from('product_costs')
    .select('sale_price, total_cost, margin_pct')
    .eq('id', productoId)
    .maybeSingle()
  if (!costs) return
  await supabase.from('producto_price_history').insert({
    producto_id: productoId,
    tenant_id: tenantId,
    sale_price: costs.sale_price ?? 0,
    total_cost: costs.total_cost ?? null,
    margin_pct: costs.margin_pct ?? null,
    created_by: userId,
  })
}

export async function createProducto(values: ProductoFormValues): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

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

    if (values.ingredientes.length > 0) {
      const { error: ingErr } = await supabase
        .from('receta_ingredientes')
        .insert(buildIngredientesRows(receta.id, values))
      if (ingErr) {
        await supabase.from('recetas').delete().eq('id', receta.id)
        return { error: mapError(ingErr.message) }
      }
    }

    const conceptoRes = await resolveConceptoId(supabase, tenantId, values.concepto_name)
    if (conceptoRes.error) {
      await supabase.from('recetas').delete().eq('id', receta.id)
      return { error: conceptoRes.error }
    }

    const { data: producto, error } = await supabase.from('productos').insert({
      name: values.name,
      sale_price: values.sale_price,
      receta_id: receta.id,
      target_margin_pct: values.target_margin_pct,
      is_dynamic: values.is_dynamic,
      tenant_id: tenantId,
      concepto_id: conceptoRes.id,
      canal: values.canal,
      formato: values.formato,
    }).select('id').single()

    if (error) {
      await supabase.from('recetas').delete().eq('id', receta.id)
      return { error: mapError(error.message) }
    }

    const descErr = await syncDescartables(supabase, producto.id, values)
    if (descErr) return { error: descErr }

    const { data: { user } } = await supabase.auth.getUser()
    await snapshotPriceHistory(supabase, producto.id, tenantId, user?.id ?? null)

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

    // Leer precio actual para detectar si cambió
    const { data: current } = await supabase
      .from('productos')
      .select('sale_price')
      .eq('id', id)
      .maybeSingle()
    const oldPrice = current?.sale_price ?? null

    let recetaId = values.receta_id ?? null

    if (!recetaId) {
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
      const { error: recetaErr } = await supabase
        .from('recetas')
        .update({
          name: values.name,
          yield_qty: values.yield_qty,
          yield_unit: values.yield_unit,
        })
        .eq('id', recetaId)
      if (recetaErr) return { error: recetaErr.message }

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

    const conceptoRes = await resolveConceptoId(supabase, tenantId, values.concepto_name)
    if (conceptoRes.error) return { error: conceptoRes.error }

    const { error } = await supabase
      .from('productos')
      .update({
        name: values.name,
        sale_price: values.sale_price,
        receta_id: recetaId,
        target_margin_pct: values.target_margin_pct,
        is_dynamic: values.is_dynamic,
        concepto_id: conceptoRes.id,
        canal: values.canal,
        formato: values.formato,
      })
      .eq('id', id)

    if (error) return { error: mapError(error.message) }

    const descErr = await syncDescartables(supabase, id, values)
    if (descErr) return { error: descErr }

    if (oldPrice !== values.sale_price) {
      const { data: { user } } = await supabase.auth.getUser()
      await snapshotPriceHistory(supabase, id, tenantId, user?.id ?? null)
    }

    revalidatePath('/catalogo/productos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function updateProductoPrecio(
  id: string,
  salePrice: number,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    const { data: current } = await supabase
      .from('productos')
      .select('sale_price')
      .eq('id', id)
      .maybeSingle()

    if (current?.sale_price === salePrice) return {}

    const { error } = await supabase
      .from('productos')
      .update({ sale_price: salePrice })
      .eq('id', id)
    if (error) return { error: mapError(error.message) }

    const { data: { user } } = await supabase.auth.getUser()
    await snapshotPriceHistory(supabase, id, tenantId, user?.id ?? null)

    revalidatePath('/catalogo/productos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function fetchProductoPriceHistory(
  productoId: string,
): Promise<{ data: ProductoPriceHistoryEntry[] }> {
  try {
    const { getProductoPriceHistory } = await import('./queries')
    const data = await getProductoPriceHistory(productoId)
    return { data }
  } catch {
    return { data: [] }
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
