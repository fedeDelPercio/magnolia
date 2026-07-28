'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { InsumoFormValues } from './schemas'
import { getInsumoHistory, getStockAjustes, type PriceHistoryEntry, type StockAjusteEntry } from './queries'

export async function fetchInsumoHistory(
  insumoId: string,
): Promise<{ data: PriceHistoryEntry[] }> {
  try {
    const data = await getInsumoHistory(insumoId)
    return { data }
  } catch {
    return { data: [] }
  }
}

function mapError(msg: string): string {
  if (msg.includes('unique')) return 'Ya existe un insumo con ese nombre'
  return msg
}

// Ultima compra que incluyo este insumo (por fecha). Se usa para el atajo
// "Corregir precio" del catalogo: el precio actual del insumo lo fijo su
// ultima compra, asi que corregir cantidad/monto ahi es la forma prolija de
// arreglar un precio mal cargado (recalcula current_price e historial).
export async function getUltimaCompraDeInsumo(
  insumoId: string,
): Promise<{ compraId: string; proveedorId: string } | null> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data } = await supabase
    .from('compras')
    .select('id, proveedor_id, fecha, compra_items!inner(insumo_id)')
    .eq('tenant_id', tenantId)
    .eq('compra_items.insumo_id', insumoId)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!data) return null
  return { compraId: data.id, proveedorId: data.proveedor_id }
}

// Cuando se activa control de stock, hay que sembrar un ajuste con la fecha
// actual. Sin esto, la vista `insumo_stock` resta el consumo histórico desde
// siempre y arroja stock negativo aunque el inicial sea positivo (porque
// "stock_inicial" no lleva fecha — el ajuste sí).
// Idempotente: si ya hay un ajuste para el insumo, no hace nada.
async function ensureInitialStockAjuste(
  supabase: Awaited<ReturnType<typeof createClient>>,
  insumoId: string,
  tenantId: string,
  trackStock: boolean,
  stockInicial: number,
): Promise<void> {
  if (!trackStock) return
  const { count } = await supabase
    .from('insumo_stock_ajustes')
    .select('id', { count: 'exact', head: true })
    .eq('insumo_id', insumoId)
  if ((count ?? 0) > 0) return
  const { data: { user } } = await supabase.auth.getUser()
  await supabase.from('insumo_stock_ajustes').insert({
    insumo_id: insumoId,
    tenant_id: tenantId,
    stock_teorico: 0,
    stock_real: stockInicial,
    notas: 'Stock inicial al activar control',
    created_by: user?.id ?? null,
  })
}

export async function createInsumo(
  values: InsumoFormValues,
): Promise<{ error?: string; data?: { id: string; name: string; unit: string; current_price: number; purchase_unit_label: string | null; purchase_unit_factor: number | null } }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    const { data, error } = await supabase
      .from('insumos')
      .insert({
        name: values.name,
        kind: values.kind,
        unit: values.unit,
        current_price: values.current_price,
        proveedor_id: values.proveedor_id ?? null,
        perishable: values.perishable,
        shelf_life_days: values.perishable ? (values.shelf_life_days ?? null) : null,
        track_stock: values.track_stock,
        stock_inicial: values.track_stock ? (values.stock_inicial ?? 0) : 0,
        purchase_unit_label: values.purchase_unit_label ?? null,
        purchase_unit_factor: values.purchase_unit_factor ?? null,
        tenant_id: tenantId,
      })
      .select('id, name, unit, current_price, purchase_unit_label, purchase_unit_factor')
      .single()

    if (error) return { error: mapError(error.message) }

    await ensureInitialStockAjuste(
      supabase,
      data.id,
      tenantId,
      values.track_stock,
      values.track_stock ? (values.stock_inicial ?? 0) : 0,
    )

    revalidatePath('/catalogo/insumos')
    return { data: data as { id: string; name: string; unit: string; current_price: number; purchase_unit_label: string | null; purchase_unit_factor: number | null } }
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
    const tenantId = await getActiveTenantId()

    const { data: existing } = await supabase
      .from('insumos')
      .select('current_price')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('insumos')
      .update({
        name: values.name,
        kind: values.kind,
        unit: values.unit,
        current_price: values.current_price,
        proveedor_id: values.proveedor_id ?? null,
        perishable: values.perishable,
        shelf_life_days: values.perishable ? (values.shelf_life_days ?? null) : null,
        track_stock: values.track_stock,
        stock_inicial: values.track_stock ? (values.stock_inicial ?? 0) : 0,
        // Si se apaga el tracking, limpiamos la trazabilidad de la compra que
        // lo habia activado (sino la FK queda apuntando a una compra cuyo
        // tracking ya no esta vigente).
        ...(values.track_stock ? {} : { stock_inicial_compra_id: null }),
        purchase_unit_label: values.purchase_unit_label ?? null,
        purchase_unit_factor: values.purchase_unit_factor ?? null,
      })
      .eq('id', id)

    if (error) return { error: mapError(error.message) }

    await ensureInitialStockAjuste(
      supabase,
      id,
      tenantId,
      values.track_stock,
      values.track_stock ? (values.stock_inicial ?? 0) : 0,
    )

    const priceChanged = existing && Number(existing.current_price) !== Number(values.current_price)
    if (priceChanged && values.current_price > 0) {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('insumo_price_history').insert({
        insumo_id: id,
        tenant_id: tenantId,
        price: values.current_price,
        source: 'manual',
        proveedor_id: values.proveedor_id ?? null,
        created_by: user?.id ?? null,
      })
    }

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

export async function fetchStockAjustes(
  insumoId: string,
): Promise<{ data: StockAjusteEntry[] }> {
  try {
    const data = await getStockAjustes(insumoId)
    return { data }
  } catch {
    return { data: [] }
  }
}

export async function registrarAjusteStock(
  insumoId: string,
  stockTeorico: number,
  stockReal: number,
  notas?: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('insumo_stock_ajustes')
      .insert({
        insumo_id: insumoId,
        tenant_id: tenantId,
        stock_teorico: stockTeorico,
        stock_real: stockReal,
        notas: notas || null,
        created_by: user?.id ?? null,
      })

    if (error) return { error: error.message }
    revalidatePath('/catalogo/insumos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

// Fetch del insumo completo con su proveedor + stock para abrir el InsumoDialog
// embebido desde el modal de comprobantes. Devolvemos null si no existe o no
// pertenece al tenant.
export async function getInsumoFullForEdit(insumoId: string) {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const [insumoRes, stockRes] = await Promise.all([
    supabase
      .from('insumos')
      .select('*, proveedores(id, name)')
      .eq('tenant_id', tenantId)
      .eq('id', insumoId)
      .single(),
    supabase
      .from('insumo_stock')
      .select('stock_actual, stock_referencia, unit')
      .eq('insumo_id', insumoId)
      .maybeSingle(),
  ])
  if (insumoRes.error || !insumoRes.data) return null
  return { ...insumoRes.data, stock: stockRes.data ?? null }
}

// ---- Despiece ----------------------------------------------

export type DespieceItemInput = {
  hijo_id: string
  qty_por_unidad: number
}

// Reemplaza el set completo de despiece del padre por el nuevo. Si la lista
// viene vacia, marca el insumo como no-padre y borra el despiece. Si tiene
// items, marca is_despiece_parent=true y track_stock=false (el padre no
// acumula stock propio cuando se despieza al comprar).
export async function saveDespiece(
  parentId: string,
  items: DespieceItemInput[],
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    // Validar que ningun hijo sea el propio padre y no haya duplicados
    if (items.some((i) => i.hijo_id === parentId)) {
      return { error: 'Un insumo no puede ser hijo de si mismo' }
    }
    const ids = new Set(items.map((i) => i.hijo_id))
    if (ids.size !== items.length) return { error: 'Hay insumos hijos duplicados' }

    const { error: delErr } = await supabase
      .from('insumo_despiece')
      .delete()
      .eq('parent_id', parentId)
    if (delErr) return { error: delErr.message }

    if (items.length > 0) {
      const { error: insErr } = await supabase.from('insumo_despiece').insert(
        items.map((i) => ({
          tenant_id: tenantId,
          parent_id: parentId,
          hijo_id: i.hijo_id,
          qty_por_unidad: i.qty_por_unidad,
        })),
      )
      if (insErr) return { error: insErr.message }
    }

    await supabase
      .from('insumos')
      .update({
        is_despiece_parent: items.length > 0,
        // Si pasamos a ser padre, no llevamos stock propio (el stock va a los hijos).
        ...(items.length > 0 ? { track_stock: false } : {}),
      })
      .eq('id', parentId)

    revalidatePath('/catalogo/insumos')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

// Trae el despiece actual del padre para poblar la UI.
export async function fetchDespiece(parentId: string): Promise<{
  data: Array<{ hijo_id: string; qty_por_unidad: number; hijo_name: string; hijo_unit: string }>
}> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('insumo_despiece')
      .select('hijo_id, qty_por_unidad, hijo:insumos!insumo_despiece_hijo_id_fkey(name, unit)')
      .eq('parent_id', parentId)
      .order('qty_por_unidad', { ascending: false })

    const rows = (data ?? []) as unknown as Array<{
      hijo_id: string
      qty_por_unidad: number
      hijo: { name: string; unit: string } | null
    }>
    return {
      data: rows.map((r) => ({
        hijo_id: r.hijo_id,
        qty_por_unidad: Number(r.qty_por_unidad),
        hijo_name: r.hijo?.name ?? '',
        hijo_unit: r.hijo?.unit ?? '',
      })),
    }
  } catch {
    return { data: [] }
  }
}

// Insumos elegibles como hijos de un despiece: del mismo tenant, activos, que
// no sean el propio padre, y que no sean a su vez padres de otro despiece (no
// anidamos despieces en este modelo).
export async function listInsumosForDespiece(parentId: string | null): Promise<
  Array<{ id: string; name: string; unit: string }>
> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  let query = supabase
    .from('insumos')
    .select('id, name, unit')
    .eq('tenant_id', tenantId)
    .eq('active', true)
    .eq('is_despiece_parent', false)
    .order('name')
  if (parentId) query = query.neq('id', parentId)
  const { data } = await query
  return data ?? []
}

// Trae los despieces de varios padres en una sola query. Devuelve un map
// parent_id -> hijos[]. Usado por la UI de compras/comprobante para mostrar
// preview de "esta compra va a generar X de pechuga + Y de patas".
export async function getDespiecesByParents(
  parentIds: string[],
): Promise<Record<string, Array<{ hijo_name: string; qty_por_unidad: number; hijo_unit: string }>>> {
  if (parentIds.length === 0) return {}
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data } = await supabase
    .from('insumo_despiece')
    .select('parent_id, qty_por_unidad, hijo:insumos!insumo_despiece_hijo_id_fkey(name, unit)')
    .eq('tenant_id', tenantId)
    .in('parent_id', parentIds)

  const map: Record<string, Array<{ hijo_name: string; qty_por_unidad: number; hijo_unit: string }>> = {}
  for (const row of (data ?? []) as unknown as Array<{
    parent_id: string
    qty_por_unidad: number
    hijo: { name: string; unit: string } | null
  }>) {
    const arr = map[row.parent_id] ?? []
    arr.push({
      hijo_name: row.hijo?.name ?? '',
      qty_por_unidad: Number(row.qty_por_unidad),
      hijo_unit: row.hijo?.unit ?? '',
    })
    map[row.parent_id] = arr
  }
  return map
}

// Borra el insumo de forma destructiva: arrastra TODAS las referencias
// (compra_items, ingredientes en recetas/productos, despieces, historial,
// ajustes). Las compras y recetas que usaban este insumo van a quedar sin
// esa linea — eso es intencional, decision explicita del usuario.
export async function deleteInsumo(id: string): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()

    // Borrar todas las referencias en orden, ignorando errores individuales
    // (si una tabla no existe o esta vacia no nos importa).
    await Promise.all([
      supabase.from('compra_items').delete().eq('insumo_id', id),
      supabase.from('receta_ingredientes').delete().eq('insumo_id', id),
      supabase.from('producto_descartables').delete().eq('insumo_id', id),
      supabase.from('insumo_despiece').delete().eq('parent_id', id),
      supabase.from('insumo_despiece').delete().eq('hijo_id', id),
      supabase.from('insumo_price_history').delete().eq('insumo_id', id),
      supabase.from('insumo_stock_ajustes').delete().eq('insumo_id', id),
    ])

    const { error } = await supabase.from('insumos').delete().eq('id', id)
    if (error) return { error: error.message }

    revalidatePath('/catalogo/insumos')
    revalidatePath('/proveedores')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
