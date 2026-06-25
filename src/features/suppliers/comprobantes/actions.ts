'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

import { extractComprobante, COMPROBANTE_MODEL } from './claude-vision'
import { normalizeAliasText } from './normalize'
import { matchItemsConInsumos } from './queries'
import { expandDespiece } from '@/features/catalog/insumos/despiece'
import { revertTrackingForCompra } from '../stock-tracking'
import type { ItemConMatch } from './schemas'
import type { Json, Tables } from '@/types/database'

const BUCKET = 'comprobantes'
const MAX_SIZE = 30 * 1024 * 1024

export type UploadResult = {
  uploadId?: string
  fecha?: string | null
  total_general?: number | null
  items?: ItemConMatch[]
  observaciones?: string | null
  error?: string
}

// Devuelve un path unico bajo {tenantId}/ para que el cliente suba el archivo
// directo al bucket. El upload directo no pasa por el server action y esquiva
// el limite de payload de 4.5MB de Vercel.
export async function getComprobanteUploadPath(fileName: string): Promise<{ path: string }> {
  const tenantId = await getActiveTenantId()
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  return { path: `${tenantId}/${crypto.randomUUID()}-${safeName}` }
}

// Parsea un archivo que YA fue subido a Storage por el cliente (directo, sin
// pasar por el server action — esto evita el limite de 4.5MB de Vercel para
// payloads de server actions). Crea la row en comprobante_uploads, baja el
// archivo, lo manda a la IA y devuelve items con matches.
export async function parseUploadedComprobante(
  proveedorId: string,
  storagePath: string,
  mimeType: string,
): Promise<UploadResult> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Validacion de seguridad: el path tiene que empezar con el tenant del user
  // para evitar que alguien intente parsear archivos de otro tenant.
  if (!storagePath.startsWith(`${tenantId}/`)) {
    return { error: 'Path invalido' }
  }

  // 1) Bajar el archivo de Storage
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(storagePath)
  if (dlErr || !blob) {
    return { error: `No se pudo leer el archivo subido: ${dlErr?.message ?? 'desconocido'}` }
  }
  if (blob.size > MAX_SIZE) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { error: 'El archivo supera los 30 MB' }
  }
  const buffer = Buffer.from(await blob.arrayBuffer())

  // 2) Crear row pending
  const { data: row, error: insertErr } = await supabase
    .from('comprobante_uploads')
    .insert({
      tenant_id: tenantId,
      proveedor_id: proveedorId,
      storage_path: storagePath,
      mime_type: mimeType,
      status: 'parsing',
      ai_model: COMPROBANTE_MODEL,
      uploaded_by: user?.id ?? null,
    })
    .select('id')
    .single()
  if (insertErr || !row) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { error: `DB: ${insertErr?.message ?? 'no row'}` }
  }

  // 3) Llamar a la IA
  const vision = await extractComprobante(buffer, mimeType)
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

  // 4) Match contra insumos del tenant (aliases primero, fuzzy de fallback)
  const itemsConMatch = await matchItemsConInsumos(vision.extract.items, proveedorId)

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
  // Texto crudo detectado por la IA en el comprobante; se usa para memorizar
  // el alias (texto -> insumo) para este proveedor y auto-matchear la
  // proxima vez. Opcional para mantener compat con flows que no traen el texto.
  raw_text?: string
  // Si true Y el insumo no tenia track_stock activo, lo activa ahora y
  // setea stock_inicial = qty (de ESTA compra). Si ya tenia tracking, ignora.
  start_tracking?: boolean
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

  // Memorizar (raw_text -> insumo_id) por proveedor para auto-matchear la
  // proxima factura del mismo proveedor con el mismo texto. Se hace ANTES
  // del expandDespiece porque queremos aprender el insumo que el user vio
  // y aprobo (el padre), no los hijos expandidos. Dedup por texto normalizado
  // para evitar conflicts ON CONFLICT del mismo upsert.
  const aliasInputs = items
    .map((it) => ({
      raw: (it.raw_text ?? '').trim(),
      insumo_id: it.insumo_id,
    }))
    .filter((it) => it.raw.length > 0)
  const aliasByNormalized = new Map<string, { raw: string; insumo_id: string }>()
  for (const a of aliasInputs) {
    const norm = normalizeAliasText(a.raw)
    if (norm && !aliasByNormalized.has(norm)) aliasByNormalized.set(norm, a)
  }
  if (aliasByNormalized.size > 0) {
    const rows = Array.from(aliasByNormalized.entries()).map(([normalized, a]) => ({
      tenant_id: tenantId,
      proveedor_id: proveedorId,
      insumo_id: a.insumo_id,
      raw_text: a.raw,
      raw_text_normalized: normalized,
    }))
    // Si el alias ya existe pero apunta a otro insumo, lo actualizamos al
    // nuevo (el ultimo match aprobado por el user gana). Incrementamos hit_count.
    await supabase.from('insumo_aliases').upsert(rows, {
      onConflict: 'tenant_id,proveedor_id,raw_text_normalized',
      ignoreDuplicates: false,
    })
  }

  // Activar tracking de stock + setear stock_inicial = qty de esta compra para
  // los items donde el user lo pidio explicitamente. Hacemos sobre los items
  // ORIGINALES (no expandidos): si el user marca el padre, activa el padre.
  // Si el insumo ya tiene track_stock=true, ignoramos para no pisar stock real.
  // Guardamos compra.id en stock_inicial_compra_id para poder revertir si esta
  // compra despues se borra (evita stock fantasma en el catalogo).
  const itemsConTracking = items.filter((it) => it.start_tracking && it.insumo_id)
  if (itemsConTracking.length > 0) {
    const { data: insumosState } = await supabase
      .from('insumos')
      .select('id, track_stock')
      .in('id', itemsConTracking.map((it) => it.insumo_id))
    const yaTrackeados = new Set((insumosState ?? []).filter((i) => i.track_stock).map((i) => i.id))
    for (const it of itemsConTracking) {
      if (yaTrackeados.has(it.insumo_id)) continue
      await supabase
        .from('insumos')
        .update({ track_stock: true, stock_inicial: it.qty, stock_inicial_compra_id: compra.id })
        .eq('id', it.insumo_id)
    }
  }

  // Si alguno de los items apunta a un insumo padre con despiece, lo expandimos
  // a items por hijo antes de insertar — mismo trato que createCompra.
  const expanded = await expandDespiece(supabase, tenantId, items)

  const { error: itemsErr } = await supabase.from('compra_items').insert(
    expanded.map((item) => ({
      compra_id: compra.id,
      insumo_id: item.insumo_id,
      qty: item.qty,
      unit: item.unit,
      unit_price: item.unit_price,
    })),
  )

  if (itemsErr) {
    // Rollback manual: revertir tracking activado y borrar la compra
    await revertTrackingForCompra(supabase, compra.id)
    await supabase.from('compras').delete().eq('id', compra.id)
    return { error: itemsErr.message }
  }

  // Actualizar current_price de los insumos (replicar el flow de createCompra)
  for (const item of expanded) {
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

// Re-fetch del insumo despues de editarlo desde el modal de revision, para
// que la conversion (purchase_unit_label/factor) y precio queden sincronizados
// sin tener que cerrar y reabrir el modal de comprobante.
export async function refreshInsumoForComprobante(insumoId: string) {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data, error } = await supabase
    .from('insumos')
    .select('id, name, unit, current_price, purchase_unit_label, purchase_unit_factor, track_stock')
    .eq('tenant_id', tenantId)
    .eq('id', insumoId)
    .single()
  if (error || !data) return null
  return data
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
