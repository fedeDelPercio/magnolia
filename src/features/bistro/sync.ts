import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type { Database, Json } from '@/types/database'
import {
  fetchTransactions,
  parseTransactionDateTime,
  requestToken,
  BistroApiError,
  type BistroLine,
  type BistroTransaction,
} from './api-client'

type Client = SupabaseClient<Database>

const PAGE_LIMIT = 1000
const TOKEN_REFRESH_BUFFER_MS = 5 * 60_000
const AR_TZ = 'America/Argentina/Buenos_Aires'
// En el Bistrosoft de Magnolia, tanto VENTA como COMANDA representan tickets
// cobrados (vienen con payment_method asignado: EFECTIVO/TARJETA/QR/ONLINE).
// La diferencia entre ambos es interna del POS (probablemente "factura emitida"
// vs "comprobante sin factura"). Bistrosoft suma los dos en su panel de
// facturación, así que nosotros también. Validado contrastando con el reporte
// de "Ventas por medio de pago" de Bistro: COMANDA+VENTA por bucket matchea
// al peso con lo que muestra Bistro.
const VENTA_TYPES = new Set([
  'VENTA',
  'VENTA (Multipago)',
  'VENTA (Pago parcial)',
  'COMANDA',
  'COMANDA (Multipago)',
  'COMANDA (Pago parcial)',
])

const PAYMENT_BUCKETS = {
  efectivo: ['EFECTIVO'],
  tarjetas: ['TARJETA', 'TARJETA DE CREDITO', 'TARJETA DE DEBITO', 'TARJETAS'],
  qr: ['QR', 'MERCADO PAGO QR'],
  online: ['ONLINE', 'MERCADO PAGO', 'TRANSFERENCIA'],
  cuenta_cliente: ['CUENTA CLIENTE', 'CTA CLIENTE'],
}

function bucketForPaymentMethod(m: string | null | undefined): keyof typeof PAYMENT_BUCKETS | null {
  if (!m) return null
  const norm = m.toUpperCase().trim()
  for (const [bucket, keywords] of Object.entries(PAYMENT_BUCKETS)) {
    if (keywords.some((k) => norm.includes(k))) return bucket as keyof typeof PAYMENT_BUCKETS
  }
  return null
}

function isSalon(origin: string | null | undefined): boolean {
  if (!origin) return false
  const norm = origin.toLowerCase()
  return norm.includes('salón') || norm.includes('salon')
}

function fechaArgentina(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: AR_TZ })
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ============================================================================
// Token cache (DB-persisted)
// ============================================================================

async function getValidToken(client: Client, tenantId: string): Promise<string> {
  const { data: credsRow, error } = await client.rpc('bistro_get_credentials', {
    p_tenant_id: tenantId,
  })
  if (error) throw new Error(`No se pudieron leer credenciales: ${error.message}`)
  const creds = credsRow?.[0]
  if (!creds?.username || !creds?.password) throw new Error('Credenciales Bistrosoft no configuradas')

  const expiresAt = creds.last_token_expires_at ? new Date(creds.last_token_expires_at) : null
  if (creds.last_token && expiresAt && expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return creds.last_token
  }

  const { token, expiresAt: newExpiresAt } = await requestToken(creds.username, creds.password)
  const { error: updErr } = await client.rpc('bistro_update_token', {
    p_tenant_id: tenantId,
    p_token: token,
    p_expires_at: newExpiresAt.toISOString(),
  })
  if (updErr) throw new Error(`No se pudo cachear el token: ${updErr.message}`)
  return token
}

// ============================================================================
// SKU / nombre → producto matching
// ============================================================================

type MatchMaps = {
  bySku: Map<string, string>
  byNameAlias: Map<string, string>
  byNameExact: Map<string, string>
  byNameNorm: Map<string, string>
}

async function loadMatchMaps(client: Client, tenantId: string): Promise<MatchMaps> {
  const [productosRes, aliasesRes] = await Promise.all([
    client.from('productos').select('id, name').eq('tenant_id', tenantId).eq('active', true),
    client
      .from('producto_aliases')
      .select('alias, producto_id, source')
      .eq('tenant_id', tenantId)
      .in('source', ['bistrosoft', 'bistrosoft_sku']),
  ])

  const byNameExact = new Map<string, string>()
  const byNameNorm = new Map<string, string>()
  for (const p of productosRes.data ?? []) {
    byNameExact.set(p.name, p.id)
    byNameNorm.set(normalize(p.name), p.id)
  }

  const bySku = new Map<string, string>()
  const byNameAlias = new Map<string, string>()
  for (const a of aliasesRes.data ?? []) {
    if (a.source === 'bistrosoft_sku') bySku.set(a.alias.trim(), a.producto_id)
    else byNameAlias.set(normalize(a.alias), a.producto_id)
  }
  return { bySku, byNameAlias, byNameExact, byNameNorm }
}

function matchItem(item: BistroLine, maps: MatchMaps): string | null {
  if (item.sku) {
    const hit = maps.bySku.get(item.sku.trim())
    if (hit) return hit
  }
  if (item.item) {
    const norm = normalize(item.item)
    if (maps.byNameAlias.has(norm)) return maps.byNameAlias.get(norm)!
    if (maps.byNameExact.has(item.item)) return maps.byNameExact.get(item.item)!
    if (maps.byNameNorm.has(norm)) return maps.byNameNorm.get(norm)!
  }
  return null
}

// ============================================================================
// Upsert de transacción + items
// ============================================================================

type UpsertOutcome = {
  inserted: boolean
  updated: boolean
  unmappedItems: number
}

async function upsertTransaction(
  client: Client,
  tenantId: string,
  tx: BistroTransaction,
  defaultShopCode: string,
  maps: MatchMaps,
): Promise<UpsertOutcome> {
  if (!tx.date || !tx.time) return { inserted: false, updated: false, unmappedItems: 0 }

  const fechaHora = parseTransactionDateTime(tx.date, tx.time)
  const shopCode = tx.shopCode?.trim() || defaultShopCode

  const payload = {
    tenant_id: tenantId,
    shop_code: shopCode,
    ticket_number: tx.ticketNumber,
    fecha_hora: fechaHora.toISOString(),
    fecha_local: fechaArgentina(fechaHora),
    transaction_type: tx.transactionType ?? 'UNKNOWN',
    origin: tx.origin ?? null,
    payment_method: tx.paymentMethod ?? null,
    amount_total: tx.amount ?? 0,
    user_name: tx.user ?? null,
    client_name: tx.client ?? null,
    comments: tx.comments ?? null,
    raw_payload: JSON.parse(JSON.stringify(tx)) as Json,
    synced_at: new Date().toISOString(),
  }

  // Conflict key incluye fecha_hora + transaction_type para soportar movimientos
  // administrativos (APERTURA / CIERRE / RETIRO / DEPOSITO) que la API devuelve
  // todos con ticketNumber=0. Sin esto, todos los ticket=0 del mismo dia
  // colisionaban y solo persistia uno (el ultimo upserteado del dia pisaba al resto).
  const { data: upserted, error: upsertErr } = await client
    .from('bistro_transacciones')
    .upsert(payload, { onConflict: 'tenant_id,shop_code,fecha_local,ticket_number,fecha_hora,transaction_type' })
    .select('id, synced_at, raw_payload')
    .single()
  if (upsertErr || !upserted) throw new Error(`Upsert ticket ${tx.ticketNumber}: ${upsertErr?.message}`)

  // Heurística "inserted vs updated": comparamos timestamps. El upsert no nos lo da
  // directo, pero podemos asumir inserted si synced_at = ahora ± 2s.
  const wasInserted =
    Math.abs(new Date(upserted.synced_at).getTime() - new Date(payload.synced_at).getTime()) < 2000
  // (No es perfecto — para el counter es suficiente.)

  // Reemplazar items siempre (la transacción puede haber cambiado en Bistrosoft)
  await client.from('bistro_transaccion_items').delete().eq('transaccion_id', upserted.id)

  let unmapped = 0
  const items = (tx.items ?? []).map((it) => {
    const productoId = matchItem(it, maps)
    if (!productoId) unmapped++
    return {
      transaccion_id: upserted.id,
      tenant_id: tenantId,
      item_name: it.item ?? '(sin nombre)',
      sku: it.sku ?? null,
      line_type: it.type ?? 'OTHER',
      amount: it.amount ?? 0,
      quantity: it.quantity ?? 0,
      measure_unit: it.measureUnit ?? null,
      vat: it.vat ?? null,
      comments: it.comments ?? null,
      producto_id: productoId,
    }
  })

  if (items.length > 0) {
    const { error: itemsErr } = await client.from('bistro_transaccion_items').insert(items)
    if (itemsErr) throw new Error(`Insert items ticket ${tx.ticketNumber}: ${itemsErr.message}`)
  }

  // Movimientos derivados codificados por Carolina desde el POS (a partir del
  // 01/07/2026, cuando se sinceraron los saldos base). Los cajeros marcan:
  //   - RETIRO comments="RETIRO POR CIERRE - ..." → traspaso a la caja fuerte,
  //     se refleja como ingreso en caja_mayor_movimientos (origen='caja_efectivo').
  //   - RETIRO comments="OTROS - RCA" → ganancia de duenos, se refleja como
  //     egreso en caja_movimientos con categoria='Ganancia duenos'.
  // Idempotencia:
  //   - caja_mayor_movimientos: UNIQUE en bistro_tx_id.
  //   - caja_movimientos: UNIQUE parcial en (tenant_id, ref_kind, ref_id)
  //     donde ref_kind='bistro_tx' (migration 0038).
  await maybeCreateDerivedMovement(client, tenantId, upserted.id, payload)

  return { inserted: wasInserted, updated: !wasInserted, unmappedItems: unmapped }
}

const DERIVED_MOVEMENTS_FROM_DATE = '2026-07-01'

async function maybeCreateDerivedMovement(
  client: Client,
  tenantId: string,
  bistroTxId: string,
  payload: {
    fecha_local: string
    transaction_type: string
    amount_total: number
    comments: string | null
  },
): Promise<void> {
  if (payload.fecha_local < DERIVED_MOVEMENTS_FROM_DATE) return
  if (payload.transaction_type !== 'RETIRO') return
  const comments = (payload.comments ?? '').trim()
  if (!comments) return
  const commentsUpper = comments.toUpperCase()
  const monto = Math.abs(Number(payload.amount_total) || 0)
  if (monto <= 0) return

  // A) RETIRO POR CIERRE → ingreso en caja mayor (traspaso a caja fuerte).
  if (commentsUpper.includes('RETIRO POR CIERRE')) {
    const { error } = await client
      .from('caja_mayor_movimientos')
      .upsert(
        {
          tenant_id: tenantId,
          fecha: payload.fecha_local,
          tipo: 'ingreso',
          monto,
          descripcion: comments,
          source: 'bistro',
          bistro_tx_id: bistroTxId,
          origen: 'caja_efectivo',
        },
        { onConflict: 'bistro_tx_id', ignoreDuplicates: true },
      )
    if (error) console.error(`caja_mayor derived tx ${bistroTxId}: ${error.message}`)
    return
  }

  // B) OTROS - RCA → egreso en caja categoria "Ganancia duenos".
  // Match tolerante: variantes tipicas del cajero. Requiere ambas keywords
  // para evitar falsos positivos con "OTROS - ..." genericos.
  if (commentsUpper.includes('OTROS') && commentsUpper.includes('RCA')) {
    const { error } = await client
      .from('caja_movimientos')
      .upsert(
        {
          tenant_id: tenantId,
          fecha: payload.fecha_local,
          tipo: 'egreso',
          categoria: 'Ganancia dueños',
          monto,
          descripcion: comments,
          ref_kind: 'bistro_tx',
          ref_id: bistroTxId,
        },
        { onConflict: 'tenant_id,ref_kind,ref_id', ignoreDuplicates: true },
      )
    if (error) console.error(`caja_movimiento derived tx ${bistroTxId}: ${error.message}`)
    return
  }
}

// ============================================================================
// Consolidación: tickets del día → fila cierres_caja (source='api')
// ============================================================================

async function consolidateCierreForDay(
  client: Client,
  tenantId: string,
  fechaLocal: string,
  shopCode: string,
): Promise<void> {
  // Carga todas las transacciones VENTA del día/shop con sus items
  const { data: txs } = await client
    .from('bistro_transacciones')
    .select(
      'id, ticket_number, fecha_hora, transaction_type, origin, payment_method, amount_total, items:bistro_transaccion_items(item_name, quantity, amount, producto_id)',
    )
    .eq('tenant_id', tenantId)
    .eq('shop_code', shopCode)
    .eq('fecha_local', fechaLocal)

  // Borrar cierre 'api' previo del día (CASCADE limpia cierre_caja_productos)
  await client
    .from('cierres_caja')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('source', 'api')
    .eq('fecha_cierre_local', fechaLocal)
    .eq('shop_code', shopCode)

  if (!txs || txs.length === 0) return

  // Totales: sólo VENTAs cuentan para facturación
  const ventas = txs.filter((t) => VENTA_TYPES.has(t.transaction_type ?? ''))
  if (ventas.length === 0) return

  const buckets = { efectivo: 0, tarjetas: 0, qr: 0, online: 0, cuenta_cliente: 0 }
  let monto_mostrador = 0
  let monto_salon = 0
  let total_vendido = 0
  let cubiertos = 0

  for (const v of ventas) {
    const amount = Number(v.amount_total) || 0
    total_vendido += amount
    const bucket = bucketForPaymentMethod(v.payment_method)
    if (bucket) buckets[bucket] += amount
    if (isSalon(v.origin)) {
      monto_salon += amount
      // Cubiertos no viene en la API por ticket; aproximamos = 1 por venta de salón.
      cubiertos += 1
    } else {
      monto_mostrador += amount
    }
  }

  // Última fecha_hora del día → fecha_cierre (timestamp)
  const fechaCierre = ventas
    .map((v) => new Date(v.fecha_hora).getTime())
    .reduce((max, t) => (t > max ? t : max), 0)
  const fechaApertura = ventas
    .map((v) => new Date(v.fecha_hora).getTime())
    .reduce((min, t) => (t < min ? t : min), Number.POSITIVE_INFINITY)

  const ticketPromedio = ventas.length > 0 ? total_vendido / ventas.length : 0

  // Insertar cierre con source='api'
  const { data: cierre, error: cierreErr } = await client
    .from('cierres_caja')
    .insert({
      tenant_id: tenantId,
      source: 'api',
      shop_code: shopCode,
      fecha_apertura: new Date(fechaApertura).toISOString(),
      fecha_cierre: new Date(fechaCierre).toISOString(),
      operador: 'Bistrosoft API',
      razon_social: null,
      efectivo_apertura: 0,
      efectivo_cierre: 0,
      total_vendido,
      total_ventas: total_vendido,
      total_comandas: 0,
      cantidad_comandas: 0,
      cantidad_ventas: ventas.length,
      cubiertos,
      ticket_promedio: ticketPromedio,
      monto_efectivo: buckets.efectivo,
      monto_tarjetas: buckets.tarjetas,
      monto_qr: buckets.qr,
      monto_online: buckets.online,
      monto_cuenta_cliente: buckets.cuenta_cliente,
      monto_mostrador,
      monto_salon,
      total_retiros: 0,
      total_depositos: 0,
      raw_payload: { generated_from: 'bistro_api', ticket_count: ventas.length } as Json,
    })
    .select('id')
    .single()
  if (cierreErr || !cierre) throw new Error(`Consolidar cierre ${fechaLocal}: ${cierreErr?.message}`)

  // Productos: agregar por (producto_id, item_name)
  const agg = new Map<string, { producto_id: string | null; nombre: string; cantidad: number; monto: number }>()
  for (const v of ventas) {
    for (const it of v.items ?? []) {
      const key = `${it.producto_id ?? 'null'}::${it.item_name}`
      const prev = agg.get(key) ?? {
        producto_id: it.producto_id,
        nombre: it.item_name,
        cantidad: 0,
        monto: 0,
      }
      prev.cantidad += Number(it.quantity) || 0
      prev.monto += Number(it.amount) || 0
      agg.set(key, prev)
    }
  }

  if (agg.size > 0) {
    const productos = Array.from(agg.values()).map((p) => ({
      cierre_caja_id: cierre.id,
      categoria: null,
      nombre: p.nombre,
      cantidad: p.cantidad,
      monto_total: p.monto,
      producto_id: p.producto_id,
    }))
    const { error: prodErr } = await client.from('cierre_caja_productos').insert(productos)
    if (prodErr) throw new Error(`Insert productos cierre ${fechaLocal}: ${prodErr.message}`)
  }

  // -------------------------------------------------------------------------
  // Linkear con dia_operativo + popular movimientos_diarios (lo que muestra
  // la grilla /operacion/[diaId]). REEMPLAZAMOS las ventas (no sumamos) —
  // la API regenera el consolidado del día cada vez, así que si re-sync,
  // las ventas deben quedar exactas a la última corrida, no acumular.
  // -------------------------------------------------------------------------
  let diaId: string | null = null
  const { data: diaExistente } = await client
    .from('dias_operativos')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('fecha', fechaLocal)
    .maybeSingle()
  if (diaExistente) {
    diaId = diaExistente.id
  } else {
    const { data: diaNuevoId } = await client.rpc('abrir_dia', {
      p_tenant_id: tenantId,
      p_fecha: fechaLocal,
    })
    if (diaNuevoId) diaId = diaNuevoId
  }

  if (diaId) {
    await client.from('cierres_caja').update({ dia_operativo_id: diaId }).eq('id', cierre.id)

    // Agregar cantidad total por producto_id (varios items con el mismo SKU
    // sumados; descartamos no mapeados — esos se quedan en cierre_caja_productos
    // para visibilidad pero no afectan movimientos_diarios).
    const ventasPorProducto = new Map<string, number>()
    for (const p of agg.values()) {
      if (!p.producto_id) continue
      ventasPorProducto.set(p.producto_id, (ventasPorProducto.get(p.producto_id) ?? 0) + p.cantidad)
    }

    for (const [productoId, cantidad] of ventasPorProducto) {
      const { data: existing } = await client
        .from('movimientos_diarios')
        .select('id')
        .eq('dia_id', diaId)
        .eq('producto_id', productoId)
        .maybeSingle()

      if (existing) {
        await client
          .from('movimientos_diarios')
          .update({ ventas: cantidad })
          .eq('id', existing.id)
      } else {
        await client.from('movimientos_diarios').insert({
          dia_id: diaId,
          producto_id: productoId,
          ventas: cantidad,
        })
      }
    }
  }
}

// ============================================================================
// Orquestación principal
// ============================================================================

export type SyncRangeParams = {
  from: Date
  to: Date
  shopCodes?: string[]
}

export type SyncRangeResult = {
  runId: string
  status: 'ok' | 'error'
  transactionsInserted: number
  transactionsUpdated: number
  pagesFetched: number
  unmappedItemsCount: number
  errorMessage?: string
}

export async function syncRange(
  tenantId: string,
  params: SyncRangeParams,
  userId: string | null,
  externalClient?: Client,
): Promise<SyncRangeResult> {
  // Para invocaciones de cron pasamos un cliente con service-role (sin cookies);
  // para llamadas desde server actions usamos el cliente con cookies del user.
  const client = externalClient ?? (await createClient())

  // Crear sync_run inicial
  const { data: runRow, error: runErr } = await client
    .from('bistro_sync_runs')
    .insert({
      tenant_id: tenantId,
      range_from: fechaArgentina(params.from),
      range_to: fechaArgentina(params.to),
      shop_codes: params.shopCodes ?? null,
      status: 'running',
      triggered_by: userId,
    })
    .select('id')
    .single()
  if (runErr || !runRow) throw new Error(`No se pudo iniciar sync run: ${runErr?.message}`)
  const runId = runRow.id

  let inserted = 0
  let updated = 0
  let pages = 0
  let unmapped = 0

  try {
    const token = await getValidToken(client, tenantId)
    const maps = await loadMatchMaps(client, tenantId)

    // shop_code por defecto: el configurado en bistro_credentials. Si no hay,
    // usamos 'default' como placeholder (la API igualmente devuelve shopCode en cada tx).
    const { data: credRow } = await client
      .from('bistro_credentials')
      .select('shop_code')
      .eq('tenant_id', tenantId)
      .single()
    const defaultShopCode = credRow?.shop_code ?? params.shopCodes?.[0] ?? 'default'

    // Mantener set de (shop_code, fecha_local) tocados para consolidar después
    const touchedDays = new Set<string>()

    // Loop por día (chunks chicos)
    const dayCursor = new Date(params.from)
    dayCursor.setHours(0, 0, 0, 0)
    const endCursor = new Date(params.to)
    endCursor.setHours(0, 0, 0, 0)

    while (dayCursor.getTime() <= endCursor.getTime()) {
      let page = 1
      let hasMore = true
      while (hasMore) {
        const res = await fetchTransactions(token, {
          from: dayCursor,
          to: dayCursor,
          page,
          limit: PAGE_LIMIT,
          shopCodes: params.shopCodes,
        })
        pages++
        for (const tx of res.transactions ?? []) {
          const outcome = await upsertTransaction(client, tenantId, tx, defaultShopCode, maps)
          if (outcome.inserted) inserted++
          if (outcome.updated) updated++
          unmapped += outcome.unmappedItems
          const shopCode = tx.shopCode?.trim() || defaultShopCode
          const fechaLocal = tx.date && tx.time
            ? fechaArgentina(parseTransactionDateTime(tx.date, tx.time))
            : null
          if (fechaLocal) touchedDays.add(`${shopCode}::${fechaLocal}`)
        }
        hasMore = res.hasMore
        page++
      }
      dayCursor.setDate(dayCursor.getDate() + 1)
    }

    // Consolidar por (shop, día)
    for (const key of touchedDays) {
      const [shopCode, fechaLocal] = key.split('::') as [string, string]
      await consolidateCierreForDay(client, tenantId, fechaLocal, shopCode)
    }

    // Marcar OK
    await client
      .from('bistro_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'ok',
        transactions_inserted: inserted,
        transactions_updated: updated,
        pages_fetched: pages,
        unmapped_items_count: unmapped,
      })
      .eq('id', runId)

    return {
      runId,
      status: 'ok',
      transactionsInserted: inserted,
      transactionsUpdated: updated,
      pagesFetched: pages,
      unmappedItemsCount: unmapped,
    }
  } catch (e) {
    const msg = e instanceof BistroApiError
      ? `Bistrosoft API ${e.status}: ${e.message}`
      : e instanceof Error
        ? e.message
        : 'Error desconocido'
    await client
      .from('bistro_sync_runs')
      .update({
        finished_at: new Date().toISOString(),
        status: 'error',
        transactions_inserted: inserted,
        transactions_updated: updated,
        pages_fetched: pages,
        unmapped_items_count: unmapped,
        error_message: msg,
      })
      .eq('id', runId)

    return {
      runId,
      status: 'error',
      transactionsInserted: inserted,
      transactionsUpdated: updated,
      pagesFetched: pages,
      unmappedItemsCount: unmapped,
      errorMessage: msg,
    }
  }
}
