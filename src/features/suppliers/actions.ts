'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { expandDespiece } from '@/features/catalog/insumos/despiece'
import { revertTrackingForCompra } from './stock-tracking'
import type { ProveedorFormValues, CompraItemFormValues, PagoFormValues } from './schemas'

// ---- Proveedores -------------------------------------------

export async function createProveedor(
  values: ProveedorFormValues,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error } = await supabase.from('proveedores').insert({
    tenant_id: tenantId,
    name: values.name,
    contact_name: values.contact_name || null,
    contact_phone: values.contact_phone || null,
    contact_email: values.contact_email || null,
    notes: values.notes || null,
    // discrimina_iva se mantiene sincronizado con iva_rate>0 (back-compat).
    discrimina_iva: (values.iva_rate ?? 0) > 0,
    iva_rate: values.iva_rate ?? 0,
    descuento_pct: values.descuento_pct ?? 0,
    payment_rule: values.payment_rule ?? null,
  })

  if (error) {
    if (error.message.includes('unique')) return { error: 'Ya existe un proveedor con ese nombre' }
    return { error: error.message }
  }

  revalidatePath('/proveedores')
  revalidatePath('/alertas')
  return {}
}

export async function updateProveedor(
  id: string,
  values: ProveedorFormValues,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('proveedores')
    .update({
      name: values.name,
      contact_name: values.contact_name || null,
      contact_phone: values.contact_phone || null,
      contact_email: values.contact_email || null,
      notes: values.notes || null,
      discrimina_iva: (values.iva_rate ?? 0) > 0,
      iva_rate: values.iva_rate ?? 0,
      descuento_pct: values.descuento_pct ?? 0,
      payment_rule: values.payment_rule ?? null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${id}`)
  revalidatePath('/alertas')
  return {}
}

export async function toggleProveedorActive(
  id: string,
  active: boolean,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('proveedores').update({ active }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  return {}
}

// Borrado duro. Bloquea si hay historial de compras o pagos para no perder
// trazabilidad de la cuenta corriente. Para "ocultar" un proveedor con historial,
// usar toggleProveedorActive(id, false).
export async function deleteProveedor(
  id: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const [{ count: comprasCount }, { count: pagosCount }] = await Promise.all([
    supabase.from('compras').select('id', { count: 'exact', head: true }).eq('proveedor_id', id),
    supabase.from('pagos_proveedor').select('id', { count: 'exact', head: true }).eq('proveedor_id', id),
  ])

  if ((comprasCount ?? 0) > 0 || (pagosCount ?? 0) > 0) {
    return {
      error:
        'El proveedor tiene compras o pagos registrados. Desactivalo en lugar de eliminarlo para no perder el historial.',
    }
  }

  const { error } = await supabase.from('proveedores').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/proveedores')
  revalidatePath('/alertas')
  return {}
}

// ---- Compras -----------------------------------------------

// Aplica descuento e IVA sobre el precio neto de una linea para obtener el
// bruto (lo que la duena realmente paga). El bruto es el que persiste en
// insumos.current_price para que las recetas usen costo real.
function computeBrutoUnitPrice(
  unit_price_neto: number,
  ivaRateLinea: number | null,
  ivaRateGlobal: number,
  descuentoPct: number,
): number {
  const iva = ivaRateLinea ?? ivaRateGlobal
  return unit_price_neto * (1 - descuentoPct / 100) * (1 + iva / 100)
}

async function updateInsumoPrices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  compraId: string,
  proveedorId: string,
  items: CompraItemFormValues[],
  ivaRateGlobal: number,
  descuentoPct: number,
) {
  for (const item of items) {
    const { data: existing } = await supabase
      .from('insumos')
      .select('current_price, proveedor_id')
      .eq('id', item.insumo_id)
      .single()

    const brutoUnitPrice = computeBrutoUnitPrice(
      item.unit_price,
      item.iva_rate ?? null,
      ivaRateGlobal,
      descuentoPct,
    )

    // Si el insumo no tenia proveedor preferido, lo "atamos" al de esta compra.
    // No sobrescribimos si ya tenia uno — eso es decision manual desde el dialog.
    const update: { current_price: number; proveedor_id?: string } = {
      current_price: brutoUnitPrice,
    }
    if (!existing?.proveedor_id) {
      update.proveedor_id = proveedorId
    }

    await supabase
      .from('insumos')
      .update(update)
      .eq('id', item.insumo_id)

    const priceChanged = existing && Number(existing.current_price) !== Number(brutoUnitPrice)
    if (priceChanged) {
      await supabase.from('insumo_price_history').insert({
        insumo_id: item.insumo_id,
        tenant_id: tenantId,
        price: brutoUnitPrice,
        source: 'compra',
        source_id: compraId,
        proveedor_id: proveedorId,
      })
    }
  }
}

export async function createCompra(
  proveedorId: string,
  fecha: string,
  dueDate: string | null,
  notes: string | null,
  items: CompraItemFormValues[],
  ivaRate: number = 0,
  descuentoPct: number = 0,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data: compra, error: compraErr } = await supabase
    .from('compras')
    .insert({
      tenant_id: tenantId,
      proveedor_id: proveedorId,
      fecha,
      due_date: dueDate || null,
      notes: notes || null,
      iva_rate: ivaRate,
      descuento_pct: descuentoPct,
    })
    .select('id')
    .single()

  if (compraErr) return { error: compraErr.message }

  // Activar tracking de stock + setear stock_inicial cuando el user lo pidio.
  // Sobre items ORIGINALES (no expanded). Si el insumo ya tenia track_stock=true
  // lo ignoramos para no pisar stock real.
  await activateTrackingForItems(supabase, items, compra.id)

  // Expandir padres con despiece a items por hijo, asi el stock view (que lee
  // de compra_items) suma directo a los hijos sin necesidad de triggers ni
  // ajustes manuales.
  const expanded = await expandDespiece(supabase, tenantId, items)

  const { error: itemsErr } = await supabase.from('compra_items').insert(
    expanded.map((item) => ({
      compra_id: compra.id,
      insumo_id: item.insumo_id,
      qty: item.qty,
      unit: item.unit,
      unit_price: item.unit_price,
      // IVA por linea (null = usa el global de la compra).
      iva_rate: item.iva_rate ?? null,
    })),
  )

  if (itemsErr) return { error: itemsErr.message }

  await updateInsumoPrices(supabase, tenantId, compra.id, proveedorId, expanded, ivaRate, descuentoPct)

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${proveedorId}`)
  revalidatePath('/catalogo/insumos')
  return { id: compra.id }
}

// Activa track_stock=true en los insumos cuyos items vienen con start_tracking,
// usando la qty del item como stock_inicial. Si el insumo ya estaba en true,
// no toca nada (preserva el stock real). Guarda el compra_id que disparo el
// tracking para poder revertirlo si despues se borra esa compra.
async function activateTrackingForItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: CompraItemFormValues[],
  compraId: string,
): Promise<void> {
  const conTracking = items.filter((it) => it.start_tracking && it.insumo_id)
  if (conTracking.length === 0) return
  const { data: insumosState } = await supabase
    .from('insumos')
    .select('id, track_stock')
    .in('id', conTracking.map((it) => it.insumo_id))
  const yaTrackeados = new Set((insumosState ?? []).filter((i) => i.track_stock).map((i) => i.id))
  for (const it of conTracking) {
    if (yaTrackeados.has(it.insumo_id)) continue
    await supabase
      .from('insumos')
      .update({ track_stock: true, stock_inicial: it.qty, stock_inicial_compra_id: compraId })
      .eq('id', it.insumo_id)
  }
}


export async function updateCompra(
  compraId: string,
  proveedorId: string,
  fecha: string,
  dueDate: string | null,
  notes: string | null,
  items: CompraItemFormValues[],
  ivaRate: number = 0,
  descuentoPct: number = 0,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error: compraErr } = await supabase
    .from('compras')
    .update({
      fecha,
      due_date: dueDate || null,
      notes: notes || null,
      iva_rate: ivaRate,
      descuento_pct: descuentoPct,
    })
    .eq('id', compraId)

  if (compraErr) return { error: compraErr.message }

  const { error: deleteErr } = await supabase
    .from('compra_items')
    .delete()
    .eq('compra_id', compraId)

  if (deleteErr) return { error: deleteErr.message }

  const expanded = await expandDespiece(supabase, tenantId, items)

  const { error: itemsErr } = await supabase.from('compra_items').insert(
    expanded.map((item) => ({
      compra_id: compraId,
      insumo_id: item.insumo_id,
      qty: item.qty,
      unit: item.unit,
      unit_price: item.unit_price,
      iva_rate: item.iva_rate ?? null,
    })),
  )

  if (itemsErr) return { error: itemsErr.message }

  await updateInsumoPrices(supabase, tenantId, compraId, proveedorId, expanded, ivaRate, descuentoPct)

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${proveedorId}`)
  revalidatePath('/catalogo/insumos')
  return {}
}

export async function deleteCompra(
  compraId: string,
  proveedorId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Si esta compra disparo el tracking de algun insumo (F2), revertir el
  // track_stock + stock_inicial antes de borrar para que no quede stock fantasma.
  await revertTrackingForCompra(supabase, compraId)

  const { error } = await supabase.from('compras').delete().eq('id', compraId)
  if (error) return { error: error.message }

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${proveedorId}`)
  revalidatePath('/catalogo/insumos')
  return {}
}

export async function updateCompraStatus(
  compraId: string,
  status: 'pendiente' | 'pagada_parcial' | 'pagada',
  proveedorId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase.from('compras').update({ status }).eq('id', compraId)
  if (error) return { error: error.message }
  revalidatePath(`/proveedores/${proveedorId}`)
  return {}
}

// ---- Pagos -------------------------------------------------

export async function createPago(
  proveedorId: string,
  values: PagoFormValues,
  compraId?: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error } = await supabase.from('pagos_proveedor').insert({
    tenant_id: tenantId,
    proveedor_id: proveedorId,
    fecha: values.fecha,
    monto: values.monto,
    metodo: values.metodo,
    descripcion: values.descripcion || null,
    due_date: values.metodo === 'cheque' ? (values.due_date ?? null) : null,
    compra_id: compraId ?? null,
  })

  if (error) return { error: error.message }

  if (compraId) {
    await supabase
      .from('compras')
      .update({ status: 'pagada' })
      .eq('id', compraId)
      .eq('proveedor_id', proveedorId)
  }

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${proveedorId}`)
  revalidatePath('/caja')
  return {}
}

// Marca/desmarca un cheque como cobrado. Pasar null en clearedAt deshace.
export async function setChequeCleared(
  pagoId: string,
  clearedAt: string | null,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pagos_proveedor')
    .update({ cleared_at: clearedAt })
    .eq('id', pagoId)
  if (error) return { error: error.message }
  revalidatePath('/proveedores', 'layout')
  revalidatePath('/caja')
  revalidatePath('/alertas')
  return {}
}
