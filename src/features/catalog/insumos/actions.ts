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
