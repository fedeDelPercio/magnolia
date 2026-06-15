'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

import { extractComprobante, COMPROBANTE_MODEL } from './claude-vision'
import { matchItemsConInsumos } from './queries'
import type { ItemConMatch } from './schemas'
import type { Json, Tables } from '@/types/database'

const BUCKET = 'comprobantes'
const MAX_SIZE = 15 * 1024 * 1024

export type UploadResult = {
  uploadId?: string
  fecha?: string | null
  total_general?: number | null
  items?: ItemConMatch[]
  observaciones?: string | null
  error?: string
}

// Sube el archivo a Storage, crea row en comprobante_uploads, llama a la IA
// y devuelve los items con matches listos para revisión por el user.
// Lo hago todo en una sola action para simplificar el flow del cliente
// (un solo loading state, un solo error path).
export async function uploadAndParseComprobante(
  proveedorId: string,
  formData: FormData,
): Promise<UploadResult> {
  const file = formData.get('file')
  if (!(file instanceof File)) return { error: 'Archivo no recibido' }
  if (file.size > MAX_SIZE) return { error: 'El archivo supera los 15 MB' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const buffer = Buffer.from(await file.arrayBuffer())
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${tenantId}/${crypto.randomUUID()}-${safeName}`

  // 1) Upload a Storage
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })
  if (uploadErr) return { error: `Storage: ${uploadErr.message}` }

  // 2) Crear row pending
  const { data: row, error: insertErr } = await supabase
    .from('comprobante_uploads')
    .insert({
      tenant_id: tenantId,
      proveedor_id: proveedorId,
      storage_path: storagePath,
      mime_type: file.type,
      status: 'parsing',
      ai_model: COMPROBANTE_MODEL,
      uploaded_by: user?.id ?? null,
    })
    .select('id')
    .single()
  if (insertErr || !row) {
    // Cleanup del archivo subido
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { error: `DB: ${insertErr?.message ?? 'no row'}` }
  }

  // 3) Llamar a la IA
  const vision = await extractComprobante(buffer, file.type)
  if (vision.error || !vision.extract) {
    await supabase
      .from('comprobante_uploads')
      .update({
        status: 'error',
        error_message: vision.error ?? 'Sin extract',
        ai_response: (vision.rawResponse as Json) ?? null,
      })
      .eq('id', row.id)
    return { error: vision.error ?? 'La IA no devolvió datos' }
  }

  // 4) Fuzzy match contra insumos del tenant
  const itemsConMatch = await matchItemsConInsumos(vision.extract.items)

  // 5) Guardar parsed + matches
  await supabase
    .from('comprobante_uploads')
    .update({
      status: 'parsed',
      ai_response: vision.rawResponse as Json,
      parsed_items: itemsConMatch as unknown as Json,
      parsed_at: new Date().toISOString(),
    })
    .eq('id', row.id)

  return {
    uploadId: row.id,
    fecha: vision.extract.fecha,
    total_general: vision.extract.total_general,
    items: itemsConMatch,
    observaciones: vision.extract.observaciones,
  }
}

export type ApplyItem = {
  insumo_id: string
  qty: number
  unit: Tables<'insumos'>['unit']
  unit_price: number
}

// Crea la compra + items con los valores aprobados por el user. La conversión
// a unidad base (cuando el insumo tiene purchase_unit_label) ya se hizo en el
// cliente — acá guardamos qty y unit_price tal cual.
export async function applyComprobante(
  uploadId: string,
  proveedorId: string,
  fecha: string,
  dueDate: string | null,
  notes: string | null,
  items: ApplyItem[],
): Promise<{ compraId?: string; error?: string }> {
  if (items.length === 0) return { error: 'No hay items para registrar' }

  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  // Obtener storage_path para guardar url firmada en compras.comprobante_url
  const { data: upload } = await supabase
    .from('comprobante_uploads')
    .select('storage_path, ai_model')
    .eq('id', uploadId)
    .single()

  const { data: compra, error: compraErr } = await supabase
    .from('compras')
    .insert({
      tenant_id: tenantId,
      proveedor_id: proveedorId,
      fecha,
      due_date: dueDate || null,
      notes: notes || null,
      comprobante_url: upload?.storage_path ?? null,
      comprobante_meta: upload ? ({ source: 'ocr', model: upload.ai_model, upload_id: uploadId } as Json) : null,
    })
    .select('id')
    .single()

  if (compraErr || !compra) return { error: compraErr?.message ?? 'No se pudo crear la compra' }

  const { error: itemsErr } = await supabase.from('compra_items').insert(
    items.map((item) => ({
      compra_id: compra.id,
      insumo_id: item.insumo_id,
      qty: item.qty,
      unit: item.unit,
      unit_price: item.unit_price,
    })),
  )

  if (itemsErr) {
    // Rollback manual: borrar la compra creada
    await supabase.from('compras').delete().eq('id', compra.id)
    return { error: itemsErr.message }
  }

  // Actualizar current_price de los insumos (replicar el flow de createCompra)
  for (const item of items) {
    const { data: existing } = await supabase
      .from('insumos')
      .select('current_price, proveedor_id')
      .eq('id', item.insumo_id)
      .single()

    const update: { current_price: number; proveedor_id?: string } = {
      current_price: item.unit_price,
    }
    if (!existing?.proveedor_id) update.proveedor_id = proveedorId

    await supabase.from('insumos').update(update).eq('id', item.insumo_id)

    const priceChanged = existing && Number(existing.current_price) !== Number(item.unit_price)
    if (priceChanged) {
      await supabase.from('insumo_price_history').insert({
        insumo_id: item.insumo_id,
        tenant_id: tenantId,
        price: item.unit_price,
        source: 'compra',
        source_id: compra.id,
        proveedor_id: proveedorId,
      })
    }
  }

  await supabase
    .from('comprobante_uploads')
    .update({
      status: 'applied',
      compra_id: compra.id,
      applied_at: new Date().toISOString(),
    })
    .eq('id', uploadId)

  revalidatePath('/proveedores')
  revalidatePath(`/proveedores/${proveedorId}`)
  revalidatePath('/catalogo/insumos')
  return { compraId: compra.id }
}

export async function discardComprobante(uploadId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: upload } = await supabase
    .from('comprobante_uploads')
    .select('storage_path')
    .eq('id', uploadId)
    .single()

  // Borrar archivo de Storage (best-effort: si falla, el row queda discarded)
  if (upload?.storage_path) {
    await supabase.storage.from(BUCKET).remove([upload.storage_path])
  }

  const { error } = await supabase
    .from('comprobante_uploads')
    .update({ status: 'discarded' })
    .eq('id', uploadId)

  if (error) return { error: error.message }
  return {}
}
