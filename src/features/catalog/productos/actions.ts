'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type {
  ProductoFormValues,
  ProductoConVariantesFormValues,
  VariantData,
  VariantKey,
} from './schemas'
import { variantProductoName } from './schemas'
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

// canal/formato por variante. La base es la "sin variantes" del concepto.
const VARIANT_TO_CANAL: Record<VariantKey, 'salon' | 'delivery' | null> = {
  base: null,
  delivery: 'delivery',
  menu: null,
}
const VARIANT_TO_FORMATO: Record<VariantKey, 'individual' | 'menu' | null> = {
  base: null,
  delivery: null,
  menu: 'menu',
}

async function upsertVariantProducto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  key: VariantKey,
  baseName: string,
  common: Pick<ProductoConVariantesFormValues, 'target_margin_pct' | 'is_dynamic' | 'yield_qty' | 'yield_unit'>,
  variant: VariantData,
  conceptoId: string | null,
  currentUserId: string | null,
): Promise<{ id: string; oldPrice: number | null; error?: string }> {
  const canal = VARIANT_TO_CANAL[key]
  const formato = VARIANT_TO_FORMATO[key]
  const productoName = variantProductoName(baseName, key)

  // Resolver receta_id: crear una nueva si no viene, o actualizar la existente.
  // Fallback por nombre si un save previo dejo una receta huerfana con ese name
  // (unique(tenant_id, name)) para no chocar en el retry.
  let recetaId = variant.receta_id
  if (!recetaId) {
    const { data: existingReceta } = await supabase
      .from('recetas')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('name', productoName)
      .maybeSingle()
    if (existingReceta) recetaId = existingReceta.id
  }
  if (recetaId) {
    const { error: recetaErr } = await supabase
      .from('recetas')
      .update({
        name: productoName,
        yield_qty: common.yield_qty,
        yield_unit: common.yield_unit,
      })
      .eq('id', recetaId)
    if (recetaErr) return { id: '', oldPrice: null, error: recetaErr.message }
    const { error: delErr } = await supabase
      .from('receta_ingredientes')
      .delete()
      .eq('receta_id', recetaId)
    if (delErr) return { id: '', oldPrice: null, error: delErr.message }
  } else {
    const { data: nueva, error: recetaErr } = await supabase
      .from('recetas')
      .insert({
        name: productoName,
        yield_qty: common.yield_qty,
        yield_unit: common.yield_unit,
        tenant_id: tenantId,
      })
      .select('id')
      .single()
    if (recetaErr) return { id: '', oldPrice: null, error: recetaErr.message }
    recetaId = nueva.id
  }

  if (variant.ingredientes.length > 0) {
    const { error: ingErr } = await supabase.from('receta_ingredientes').insert(
      variant.ingredientes.map((i) => ({
        receta_id: recetaId,
        kind: i.kind,
        insumo_id: i.kind === 'insumo' ? (i.insumo_id ?? null) : null,
        sub_receta_id: i.kind === 'receta' ? (i.sub_receta_id ?? null) : null,
        qty: i.qty,
        unit: i.unit,
      })),
    )
    if (ingErr) return { id: '', oldPrice: null, error: mapError(ingErr.message) }
  }

  // Upsert del producto: si producto_id viene, update + re-activate. Si no,
  // buscar si hay un sibling inactivo con mismo (concepto, canal, formato) para
  // resucitar (preserva historial); si no, insertar uno nuevo.
  let productoId = variant.producto_id
  let oldPrice: number | null = null

  if (!productoId && conceptoId) {
    const base = supabase
      .from('productos')
      .select('id, active, sale_price')
      .eq('tenant_id', tenantId)
      .eq('concepto_id', conceptoId)
    const withCanal = canal === null ? base.is('canal', null) : base.eq('canal', canal)
    const withFormato = formato === null ? withCanal.is('formato', null) : withCanal.eq('formato', formato)
    const { data: match } = await withFormato.maybeSingle()
    if (match) productoId = match.id
  }

  // Fallback por nombre: si sigue null, puede que el usuario ya tenga un
  // producto con ese nombre (ej. "Rolls de Verdura Delivery") pero sin
  // concepto_id (huerfano). En ese caso lo adoptamos como esta variante.
  // Si ya esta vinculado a otro concepto distinto, error explicito para
  // que el usuario lo renombre y no borre data ajena.
  if (!productoId) {
    const { data: byName } = await supabase
      .from('productos')
      .select('id, concepto_id')
      .eq('tenant_id', tenantId)
      .eq('name', productoName)
      .maybeSingle()
    if (byName) {
      if (byName.concepto_id === null || byName.concepto_id === conceptoId) {
        productoId = byName.id
      } else {
        return {
          id: '',
          oldPrice: null,
          error: `Ya existe un producto "${productoName}" vinculado a otro concepto. Renombralo primero o unificalos manualmente.`,
        }
      }
    }
  }

  if (productoId) {
    const { data: cur } = await supabase
      .from('productos')
      .select('sale_price')
      .eq('id', productoId)
      .maybeSingle()
    oldPrice = cur?.sale_price ?? null
    const { error } = await supabase
      .from('productos')
      .update({
        name: productoName,
        sale_price: variant.sale_price,
        receta_id: recetaId,
        target_margin_pct: common.target_margin_pct,
        is_dynamic: common.is_dynamic,
        concepto_id: conceptoId,
        canal,
        formato,
        active: true,
      })
      .eq('id', productoId)
    if (error) return { id: '', oldPrice: null, error: mapError(error.message) }
  } else {
    const { data: nuevo, error } = await supabase
      .from('productos')
      .insert({
        name: productoName,
        sale_price: variant.sale_price,
        receta_id: recetaId,
        target_margin_pct: common.target_margin_pct,
        is_dynamic: common.is_dynamic,
        tenant_id: tenantId,
        concepto_id: conceptoId,
        canal,
        formato,
      })
      .select('id')
      .single()
    if (error) return { id: '', oldPrice: null, error: mapError(error.message) }
    productoId = nuevo.id
  }

  // Sync descartables (borrar + reinsertar).
  await supabase.from('producto_descartables').delete().eq('producto_id', productoId)
  if (variant.descartables.length > 0) {
    const { error } = await supabase.from('producto_descartables').insert(
      variant.descartables.map((d) => ({
        producto_id: productoId,
        insumo_id: d.insumo_id,
        qty: d.qty,
      })),
    )
    if (error) return { id: productoId, oldPrice, error: error.message }
  }

  return { id: productoId, oldPrice }
}

// Guarda un producto y sus 0-2 variantes (delivery/menu) en una sola operación.
// - `productoBaseId` es el id del producto "base" (canal=null,formato=null) si
//   ya existe. En create, va null y se crea desde cero.
// - Si el concepto no existe todavia (producto standalone que estrena variante),
//   se auto-crea con el nombre del producto.
// - Las variantes desactivadas (null en el payload) se soft-deletean (active=false)
//   si tenian una fila previa en la BD.
// - Si delivery o menu vuelven a activarse mas tarde, upsertVariantProducto
//   detecta la fila inactiva anterior y la resucita con su producto_id original
//   (preserva historial de ventas y mediciones).
export async function saveProductoConVariantes(
  productoBaseId: string | null,
  values: ProductoConVariantesFormValues,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()
    const { data: { user } } = await supabase.auth.getUser()

    const hasVariants = values.delivery !== null || values.menu !== null

    // Si hay variantes activas y no hay concepto todavia, lo creamos con el
    // nombre del producto. Si estamos en edit y el producto base ya tenia un
    // concepto_id, reutilizamos ese id.
    let conceptoId: string | null = null
    if (productoBaseId) {
      const { data: baseRow } = await supabase
        .from('productos')
        .select('concepto_id')
        .eq('id', productoBaseId)
        .maybeSingle()
      conceptoId = baseRow?.concepto_id ?? null
    }
    if (hasVariants && !conceptoId) {
      // Get-or-create: si un save previo fallo despues de crear el concepto,
      // reutilizamos el que quedo. resolveConceptoId hace lookup ilike + insert.
      const res = await resolveConceptoId(supabase, tenantId, values.name)
      if (res.error) return { error: res.error }
      conceptoId = res.id
    }

    // Base
    const baseInput: VariantData = {
      ...values.base,
      producto_id: productoBaseId ?? values.base.producto_id ?? null,
    }
    const baseRes = await upsertVariantProducto(
      supabase,
      tenantId,
      'base',
      values.name,
      values,
      baseInput,
      conceptoId,
      user?.id ?? null,
    )
    if (baseRes.error) return { error: baseRes.error }
    if (baseRes.oldPrice !== values.base.sale_price) {
      await snapshotPriceHistory(supabase, baseRes.id, tenantId, user?.id ?? null)
    }

    // Delivery / Menu
    for (const key of ['delivery', 'menu'] as const) {
      const variant = values[key]
      if (variant) {
        const res = await upsertVariantProducto(
          supabase,
          tenantId,
          key,
          values.name,
          values,
          variant,
          conceptoId,
          user?.id ?? null,
        )
        if (res.error) return { error: res.error }
        if (res.oldPrice !== variant.sale_price) {
          await snapshotPriceHistory(supabase, res.id, tenantId, user?.id ?? null)
        }
      } else if (conceptoId) {
        // Soft-delete el sibling si existia.
        const canal = VARIANT_TO_CANAL[key]
        const formato = VARIANT_TO_FORMATO[key]
        const query = supabase
          .from('productos')
          .update({ active: false })
          .eq('tenant_id', tenantId)
          .eq('concepto_id', conceptoId)
        const q1 = canal === null ? query.is('canal', null) : query.eq('canal', canal)
        const q2 = formato === null ? q1.is('formato', null) : q1.eq('formato', formato)
        await q2
      }
    }

    revalidatePath('/catalogo/productos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
