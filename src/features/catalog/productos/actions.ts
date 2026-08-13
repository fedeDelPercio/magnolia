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
import type { Database } from '@/types/database'

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
    // Si el producto tiene concepto_id, propagamos el toggle a todas las variantes
    // del concepto. Sin esto, desactivar solo el base dejaba las variantes
    // huerfanas activas y la lista colapsada mostraba una de ellas como base
    // (con otro nombre) — parecia que el producto habia desaparecido.
    const { data: prod } = await supabase
      .from('productos')
      .select('concepto_id, tenant_id')
      .eq('id', id)
      .maybeSingle()
    if (prod?.concepto_id) {
      const { error } = await supabase
        .from('productos')
        .update({ active })
        .eq('tenant_id', prod.tenant_id)
        .eq('concepto_id', prod.concepto_id)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase.from('productos').update({ active }).eq('id', id)
      if (error) return { error: error.message }
    }
    revalidatePath('/catalogo/productos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

// Eliminar producto (y sus variantes si tiene concepto). Borra:
// - producto_descartables de cada variante
// - la fila productos de cada variante
// - la receta 1:1 de cada variante (via receta_id) — sus ingredientes se van
//   por cascade
// - el concepto si queda sin variantes
//
// Puede fallar por FKs desde cierre_caja_productos o receta_del_dia; el error
// se mapea a un mensaje amable sugiriendo desactivar en vez de eliminar.
export async function deleteProducto(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: target } = await supabase
      .from('productos')
      .select('id, concepto_id, tenant_id')
      .eq('id', id)
      .maybeSingle()
    if (!target) return { error: 'No encontramos el producto' }

    // Reunir ids a borrar (todas las variantes si hay concepto).
    const { data: rows } = target.concepto_id
      ? await supabase
          .from('productos')
          .select('id, receta_id')
          .eq('tenant_id', target.tenant_id)
          .eq('concepto_id', target.concepto_id)
      : await supabase
          .from('productos')
          .select('id, receta_id')
          .eq('id', target.id)

    const productoIds = (rows ?? []).map((r) => r.id)
    const recetaIds = (rows ?? []).map((r) => r.receta_id).filter((v): v is string => !!v)

    if (productoIds.length > 0) {
      await supabase.from('producto_descartables').delete().in('producto_id', productoIds)
      await supabase.from('producto_price_history').delete().in('producto_id', productoIds)
      const { error: prodErr } = await supabase.from('productos').delete().in('id', productoIds)
      if (prodErr) {
        const msg = prodErr.message.toLowerCase()
        if (msg.includes('foreign key') || msg.includes('violates')) {
          return { error: 'No se puede eliminar: el producto ya tiene ventas cargadas o esta asignado como receta del dia. Desactivalo en vez de eliminarlo.' }
        }
        return { error: prodErr.message }
      }
    }

    if (recetaIds.length > 0) {
      // Intentamos borrar las recetas. Si alguna esta siendo usada como
      // sub-receta, va a fallar; en ese caso se dejan y no bloqueamos.
      await supabase.from('recetas').delete().in('id', recetaIds)
    }

    if (target.concepto_id) {
      // Si el concepto quedo sin productos, lo borramos tambien para no dejar
      // basura en el picker.
      const { count } = await supabase
        .from('productos')
        .select('id', { count: 'exact', head: true })
        .eq('concepto_id', target.concepto_id)
      if ((count ?? 0) === 0) {
        await supabase.from('producto_conceptos').delete().eq('id', target.concepto_id)
      }
    }

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
  common: Pick<ProductoConVariantesFormValues, 'target_margin_pct' | 'is_dynamic' | 'yield_qty' | 'yield_unit' | 'es_reventa'>,
  variant: VariantData,
  conceptoId: string | null,
  currentUserId: string | null,
  usedRecetaIds: Set<string>,
): Promise<{ id: string; oldPrice: number | null; error?: string }> {
  const canal = VARIANT_TO_CANAL[key]
  const formato = VARIANT_TO_FORMATO[key]
  const productoName = variantProductoName(baseName, key)

  // Resolver receta_id. CLAVE: cada variante necesita una receta EXCLUSIVA.
  // Si dos variantes comparten receta, cada save borra y reinserta los
  // ingredientes de la misma fila y la última variante pisa a las anteriores
  // (así se perdían las ediciones de la clienta sin ningún error visible).
  // usedRecetaIds trae las recetas ya tomadas por variantes previas de este
  // save; nunca se reutilizan — si la receta de la variante ya está tomada,
  // se le crea una propia. Prioridad: receta que ya se llama como el producto
  // (evita chocar con unique(tenant_id, name) al renombrar) > la receta actual
  // de la variante > crear una nueva.
  let recetaId: string | null = null
  const { data: byNameReceta } = await supabase
    .from('recetas')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('name', productoName)
    .maybeSingle()
  if (byNameReceta && !usedRecetaIds.has(byNameReceta.id)) recetaId = byNameReceta.id
  if (!recetaId && variant.receta_id && !usedRecetaIds.has(variant.receta_id)) {
    recetaId = variant.receta_id
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
  usedRecetaIds.add(recetaId)

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
        es_reventa: common.es_reventa,
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
        es_reventa: common.es_reventa,
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
    // Recetas ya tomadas por variantes de ESTE save: garantiza que cada
    // variante escriba en una receta exclusiva (ver upsertVariantProducto).
    const usedRecetaIds = new Set<string>()

    const baseRes = await upsertVariantProducto(
      supabase,
      tenantId,
      'base',
      values.name,
      values,
      baseInput,
      conceptoId,
      user?.id ?? null,
      usedRecetaIds,
    )
    if (baseRes.error) return { error: baseRes.error }
    if (baseRes.oldPrice !== values.base.sale_price) {
      await snapshotPriceHistory(supabase, baseRes.id, tenantId, user?.id ?? null)
    }

    // La variante Barra (delivery) SIEMPRE comparte los ingredientes del base
    // (Mostrador): entre barra y salon solo cambian los descartables. Forzamos
    // la copia aca (fuente de verdad) para que queden sincronizados aunque el
    // UI no los haya copiado o el usuario haya editado el base despues. El menu
    // del dia NO se toca: puede tener receta propia.
    if (values.delivery) {
      values.delivery = { ...values.delivery, ingredientes: values.base.ingredientes }
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
          usedRecetaIds,
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

// ---- Productos de reventa ----------------------------------------------

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export type ReventaInsumoMatch = { id: string; name: string; unit: string; score: number }

// Busca insumos candidatos para vincular a un producto de reventa, rankeados
// por similitud de nombre (token overlap + contención). Se usa para el
// "¿es el mismo insumo?" cuando la usuaria tilda "se compra hecho".
export async function findInsumosParaReventa(productName: string): Promise<ReventaInsumoMatch[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('insumos')
    .select('id, name, unit')
    .eq('active', true)
    .order('name')

  const target = normalizeName(productName)
  const targetTokens = new Set(target.split(' ').filter(Boolean))
  if (targetTokens.size === 0) return []

  const scored = (data ?? []).map((i) => {
    const n = normalizeName(i.name)
    const tokens = new Set(n.split(' ').filter(Boolean))
    const inter = [...targetTokens].filter((t) => tokens.has(t)).length
    const union = new Set([...targetTokens, ...tokens]).size
    let score = union ? inter / union : 0
    if (n === target) score = 1
    else if (n && (n.includes(target) || target.includes(n))) score = Math.max(score, 0.85)
    return { id: i.id, name: i.name, unit: i.unit as string, score }
  })

  return scored
    .filter((s) => s.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
}

// Crea un insumo simple para usar como item de reventa: kind 'ingrediente',
// track_stock on (asi el stock se descuenta por venta via la view insumo_stock),
// precio 0 (se actualiza con la primera compra). Devuelve el insumo creado para
// que el dialog lo use como el unico ingrediente 1:1 de la receta del producto.
export async function createInsumoParaReventa(
  name: string,
  unit: string,
): Promise<{ error?: string; data?: { id: string; name: string; unit: string } }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()
    const { data, error } = await supabase
      .from('insumos')
      .insert({
        name: name.trim(),
        kind: 'ingrediente',
        unit: unit as Database['public']['Enums']['unit_kind'],
        current_price: 0,
        track_stock: true,
        stock_inicial: 0,
        tenant_id: tenantId,
      })
      .select('id, name, unit')
      .single()
    if (error) return { error: mapError(error.message) }
    revalidatePath('/catalogo/insumos')
    return { data: data as { id: string; name: string; unit: string } }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
