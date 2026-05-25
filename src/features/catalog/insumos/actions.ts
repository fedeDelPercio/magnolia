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

export async function createInsumo(
  values: InsumoFormValues,
): Promise<{ error?: string; data?: { id: string; name: string; unit: string; current_price: number } }> {
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
        tenant_id: tenantId,
      })
      .select('id, name, unit, current_price')
      .single()

    if (error) return { error: mapError(error.message) }
    revalidatePath('/catalogo/insumos')
    return { data: data as { id: string; name: string; unit: string; current_price: number } }
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
        kind: values.kind,
        unit: values.unit,
        current_price: values.current_price,
        proveedor_id: values.proveedor_id ?? null,
        perishable: values.perishable,
        shelf_life_days: values.perishable ? (values.shelf_life_days ?? null) : null,
        track_stock: values.track_stock,
        stock_inicial: values.track_stock ? (values.stock_inicial ?? 0) : 0,
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
