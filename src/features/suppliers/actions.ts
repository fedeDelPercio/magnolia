'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { expandDespiece } from '@/features/catalog/insumos/despiece'
import { revertTrackingForCompra } from './stock-tracking'
import type {
  ProveedorFormValues,
  CompraItemFormValues,
  PagoFormValues,
  ConceptoServicioFormValues,
  PagoServicioFormValues,
} from './schemas'

// ---- Proveedores -------------------------------------------

export async function createProveedor(
  values: ProveedorFormValues,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { error } = await supabase.from('proveedores').insert({
    tenant_id: tenantId,
    name: values.name,
    tipo: values.tipo ?? 'insumo',
    contact_name: values.contact_name || null,
    contact_phone: values.contact_phone || null,
    contact_email: values.contact_email || null,
    notes: values.notes || null,
    // discrimina_iva se mantiene sincronizado con iva_rate>0 (back-compat).
    discrimina_iva: (values.iva_rate ?? 0) > 0,
    iva_rate: values.iva_rate ?? 0,
    descuento_pct: values.descuento_pct ?? 0,
    payment_rule: values.payment_rule ?? null,
    metodo_pago_default: values.metodo_pago_default ?? null,
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
      tipo: values.tipo ?? 'insumo',
      contact_name: values.contact_name || null,
      contact_phone: values.contact_phone || null,
      contact_email: values.contact_email || null,
      notes: values.notes || null,
      discrimina_iva: (values.iva_rate ?? 0) > 0,
      iva_rate: values.iva_rate ?? 0,
      descuento_pct: values.descuento_pct ?? 0,
      payment_rule: values.payment_rule ?? null,
      metodo_pago_default: values.metodo_pago_default ?? null,
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
  percepciones: number = 0,
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
      // El trigger on_compra_item_insert lee percepciones al calcular el total
      // — por eso lo seteamos ANTES de insertar los items.
      percepciones,
    })
    .select('id')
    .single()

  if (compraErr) return { error: compraErr.message }

  // Activar tracking de stock + setear stock_inicial cuando el user lo pidio.
  // Sobre items ORIGINALES (no expanded). Si el insumo ya tenia track_stock=true
  // lo ignoramos para no pisar stock real.
  await activateTrackingForItems(supabase, items, compra.id)
  // Y a la inversa: los que vinieron con stop_tracking, los apagamos.
  await deactivateTrackingForItems(supabase, items)

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

// Apaga track_stock=false en los insumos cuyos items vienen con stop_tracking.
// No toca stock_inicial ni stock_actual; simplemente saca el control. Si mas
// adelante la user quiere reactivar, lo hace desde el catalogo de insumos.
async function deactivateTrackingForItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: CompraItemFormValues[],
): Promise<void> {
  const aApagar = items.filter((it) => it.stop_tracking && it.insumo_id).map((it) => it.insumo_id)
  if (aApagar.length === 0) return
  await supabase
    .from('insumos')
    .update({ track_stock: false })
    .in('id', aApagar)
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
  percepciones: number = 0,
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
      // Igual que en create: percepciones se lee dentro del trigger cuando se
      // re-insertan los items abajo, asi que hay que setearlo antes.
      percepciones,
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

  // En edit tambien procesamos activate/stop tracking, para que la user pueda
  // corregir el flag sin tener que borrar y recrear la compra.
  await activateTrackingForItems(supabase, items, compraId)
  await deactivateTrackingForItems(supabase, items)

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

  // Insumos tocados por esta compra: los necesitamos DESPUES de borrar para
  // recalcular su current_price. Los capturamos antes porque el delete de la
  // compra cascadea los compra_items.
  const { data: itemsAfectados } = await supabase
    .from('compra_items')
    .select('insumo_id')
    .eq('compra_id', compraId)
  const insumoIds = [...new Set((itemsAfectados ?? []).map((i) => i.insumo_id))]

  // Si esta compra disparo el tracking de algun insumo (F2), revertir el
  // track_stock + stock_inicial antes de borrar para que no quede stock fantasma.
  await revertTrackingForCompra(supabase, compraId)

  const { error } = await supabase.from('compras').delete().eq('id', compraId)
  if (error) return { error: error.message }

  // Limpiar el historial de precios que dejo esta compra. Sin esto quedaba un
  // registro "fantasma" en insumo_price_history y, si era el ultimo, el
  // current_price seguia apuntando a un precio de una compra inexistente.
  await supabase
    .from('insumo_price_history')
    .delete()
    .eq('source', 'compra')
    .eq('source_id', compraId)

  // Recalcular current_price de cada insumo afectado al ultimo precio real que
  // quede en el historial (que tambien esta en bruto con IVA, igual que
  // current_price). Si no queda historial, dejamos el precio como esta —
  // borrar la unica compra no deberia poner el precio en 0.
  for (const insumoId of insumoIds) {
    const { data: ultimo } = await supabase
      .from('insumo_price_history')
      .select('price')
      .eq('insumo_id', insumoId)
      .order('valid_from', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (ultimo) {
      await supabase.from('insumos').update({ current_price: ultimo.price }).eq('id', insumoId)
    }
  }

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
  const tenantId = await getActiveTenantId()

  // Cuando marcamos como 'pagada' con esta accion (menu "..." -> "Marcar
  // como pagada"), garantizamos que exista al menos un pago que cubra el
  // total. Si falta plata para cubrirlo, creamos un pago automatico con
  // metodo='otro' y descripcion explicita para que:
  //   - el saldo del proveedor cierre (fórmula = compras - pagos)
  //   - la lista de pagos refleje que hubo movimiento (aunque sin detalle)
  //   - el trigger pago_proveedor_to_caja lo registre en caja_movimientos
  // Idempotente: si ya hay pagos suficientes, no crea nada.
  if (status === 'pagada') {
    const [{ data: compra }, { data: pagos }] = await Promise.all([
      supabase.from('compras').select('total').eq('id', compraId).single(),
      supabase.from('pagos_proveedor').select('monto').eq('compra_id', compraId),
    ])
    if (compra) {
      const totalPagado = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0)
      const faltante = Number(compra.total) - totalPagado
      if (faltante > 0.01) {
        const { error: pagoErr } = await supabase.from('pagos_proveedor').insert({
          tenant_id: tenantId,
          proveedor_id: proveedorId,
          fecha: new Date().toISOString().slice(0, 10),
          monto: faltante,
          metodo: 'otro',
          descripcion: 'Marcada como pagada sin detalle',
          compra_id: compraId,
        })
        if (pagoErr) return { error: pagoErr.message }
      }
    }
  }

  const { error } = await supabase.from('compras').update({ status }).eq('id', compraId)
  if (error) return { error: error.message }
  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${proveedorId}`)
  revalidatePath('/caja')
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

// ---- Proveedores de servicios: conceptos + pagos ----

export async function createConceptoServicio(
  proveedorId: string,
  values: ConceptoServicioFormValues,
): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  // Idempotente por (proveedor, lower(name)): si ya existe devolvemos el id.
  const { data: existing } = await supabase
    .from('proveedor_conceptos')
    .select('id')
    .eq('proveedor_id', proveedorId)
    .ilike('name', values.name.trim())
    .maybeSingle()
  if (existing) return { id: existing.id }

  const { data, error } = await supabase
    .from('proveedor_conceptos')
    .insert({
      tenant_id: tenantId,
      proveedor_id: proveedorId,
      name: values.name.trim(),
    })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath(`/proveedores/${proveedorId}`)
  return { id: data.id }
}

export async function updateConceptoServicio(
  conceptoId: string,
  values: ConceptoServicioFormValues,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: existing, error: fetchErr } = await supabase
    .from('proveedor_conceptos')
    .select('proveedor_id')
    .eq('id', conceptoId)
    .single()
  if (fetchErr) return { error: fetchErr.message }
  const { error } = await supabase
    .from('proveedor_conceptos')
    .update({ name: values.name.trim() })
    .eq('id', conceptoId)
  if (error) return { error: error.message }
  revalidatePath(`/proveedores/${existing.proveedor_id}`)
  return {}
}

export async function deleteConceptoServicio(
  conceptoId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('proveedor_conceptos')
    .select('proveedor_id')
    .eq('id', conceptoId)
    .single()
  const { error } = await supabase
    .from('proveedor_conceptos')
    .delete()
    .eq('id', conceptoId)
  if (error) return { error: error.message }
  if (existing?.proveedor_id) revalidatePath(`/proveedores/${existing.proveedor_id}`)
  return {}
}

export async function createPagoServicio(
  proveedorId: string,
  values: PagoServicioFormValues,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  let cajaMovimientoId: string | null = null
  if (values.generar_egreso_caja) {
    // Egreso automatico en caja mayor, mismo patron que pagos de proveedor
    // de insumo. Categoria "Pago a proveedores" que ya viene seeded.
    const { data: prov } = await supabase
      .from('proveedores')
      .select('name')
      .eq('id', proveedorId)
      .single()
    const conceptoName = values.concepto_id
      ? (await supabase
          .from('proveedor_conceptos')
          .select('name')
          .eq('id', values.concepto_id)
          .single()).data?.name
      : null
    const descripcion = conceptoName
      ? `${prov?.name ?? 'Servicio'} — ${conceptoName}`
      : (prov?.name ?? 'Servicio')
    const { data: mov, error: movErr } = await supabase
      .from('caja_movimientos')
      .insert({
        tenant_id: tenantId,
        fecha: values.fecha,
        tipo: 'egreso',
        monto: values.monto,
        descripcion,
        categoria: 'Pago a proveedores',
        ref_kind: 'pago_servicio',
      })
      .select('id')
      .single()
    if (movErr) return { error: movErr.message }
    cajaMovimientoId = mov.id
  }

  const { error } = await supabase
    .from('proveedor_servicio_pagos')
    .insert({
      tenant_id: tenantId,
      proveedor_id: proveedorId,
      concepto_id: values.concepto_id ?? null,
      fecha: values.fecha,
      monto: values.monto,
      metodo: values.metodo,
      notas: values.notas || null,
      caja_movimiento_id: cajaMovimientoId,
    })
  if (error) {
    // Si fallo el pago pero ya generamos el egreso, rollback manual del egreso
    if (cajaMovimientoId) {
      await supabase.from('caja_movimientos').delete().eq('id', cajaMovimientoId)
    }
    return { error: error.message }
  }
  revalidatePath(`/proveedores/${proveedorId}`)
  revalidatePath('/caja')
  // El método transferencia descuenta de Medios Digitales, que el dashboard mira.
  revalidatePath('/dashboard')
  return {}
}

export async function deletePagoServicio(
  pagoId: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('proveedor_servicio_pagos')
    .select('proveedor_id, caja_movimiento_id')
    .eq('id', pagoId)
    .single()

  const { error } = await supabase
    .from('proveedor_servicio_pagos')
    .delete()
    .eq('id', pagoId)
  if (error) return { error: error.message }

  // Si el pago habia generado un egreso en caja, lo borramos tambien para
  // no dejar movimientos huerfanos que sumen mal.
  if (existing?.caja_movimiento_id) {
    await supabase.from('caja_movimientos').delete().eq('id', existing.caja_movimiento_id)
  }
  if (existing?.proveedor_id) revalidatePath(`/proveedores/${existing.proveedor_id}`)
  revalidatePath('/caja')
  return {}
}
