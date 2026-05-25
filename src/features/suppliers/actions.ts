'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
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
    payment_terms_days: values.payment_terms_days,
    notes: values.notes || null,
  })

  if (error) {
    if (error.message.includes('unique')) return { error: 'Ya existe un proveedor con ese nombre' }
    return { error: error.message }
  }

  revalidatePath('/proveedores')
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
      payment_terms_days: values.payment_terms_days,
      notes: values.notes || null,
    })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${id}`)
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

// ---- Compras -----------------------------------------------

async function updateInsumoPrices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: CompraItemFormValues[],
) {
  for (const item of items) {
    await supabase
      .from('insumos')
      .update({ current_price: item.unit_price })
      .eq('id', item.insumo_id)
  }
}

export async function createCompra(
  proveedorId: string,
  fecha: string,
  dueDate: string | null,
  notes: string | null,
  items: CompraItemFormValues[],
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
    })
    .select('id')
    .single()

  if (compraErr) return { error: compraErr.message }

  const { error: itemsErr } = await supabase.from('compra_items').insert(
    items.map((item) => ({
      compra_id: compra.id,
      insumo_id: item.insumo_id,
      qty: item.qty,
      unit: item.unit,
      unit_price: item.unit_price,
    })),
  )

  if (itemsErr) return { error: itemsErr.message }

  await updateInsumoPrices(supabase, items)

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${proveedorId}`)
  revalidatePath('/catalogo/insumos')
  return { id: compra.id }
}

export async function updateCompra(
  compraId: string,
  proveedorId: string,
  fecha: string,
  dueDate: string | null,
  notes: string | null,
  items: CompraItemFormValues[],
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error: compraErr } = await supabase
    .from('compras')
    .update({ fecha, due_date: dueDate || null, notes: notes || null })
    .eq('id', compraId)

  if (compraErr) return { error: compraErr.message }

  const { error: deleteErr } = await supabase
    .from('compra_items')
    .delete()
    .eq('compra_id', compraId)

  if (deleteErr) return { error: deleteErr.message }

  const { error: itemsErr } = await supabase.from('compra_items').insert(
    items.map((item) => ({
      compra_id: compraId,
      insumo_id: item.insumo_id,
      qty: item.qty,
      unit: item.unit,
      unit_price: item.unit_price,
    })),
  )

  if (itemsErr) return { error: itemsErr.message }

  await updateInsumoPrices(supabase, items)

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

  const { error } = await supabase.from('compras').delete().eq('id', compraId)
  if (error) return { error: error.message }

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${proveedorId}`)
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
