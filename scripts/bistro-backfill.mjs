// Backfill local de transacciones Bistrosoft. Replica la logica de
// src/features/bistro/sync.ts pero standalone (sin Next.js) para procesar
// rangos largos saltando los timeouts de server actions de Vercel.
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/bistro-backfill.mjs --tenant <uuid> --from 2026-06-01 --to 2026-06-25
//
// Solo upsertea bistro_transacciones (y items). NO regenera cierres_caja
// 'api' — para eso, despues correr un sync chico desde la UI del tenant
// o esperar el cron diario.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://vclazlnvyvhmrsbuavdc.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BISTRO_API_BASE = 'https://ar-api.bistrosoft.com'
const AR_TZ = 'America/Argentina/Buenos_Aires'
const PAGE_LIMIT = 1000
const TOKEN_REFRESH_BUFFER_MS = 5 * 60_000

if (!SERVICE_KEY) {
  console.error('Falta SUPABASE_SERVICE_ROLE_KEY en env')
  process.exit(1)
}

// Parse args
const args = process.argv.slice(2)
function arg(name) {
  const idx = args.indexOf('--' + name)
  return idx >= 0 ? args[idx + 1] : null
}
const TENANT_ID = arg('tenant')
const FROM = arg('from')
const TO = arg('to')
if (!TENANT_ID || !FROM || !TO) {
  console.error('Uso: --tenant <uuid> --from YYYY-MM-DD --to YYYY-MM-DD')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function fechaArgentina(d) {
  return d.toLocaleDateString('en-CA', { timeZone: AR_TZ })
}

function formatDateForBistro(date) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${date.getFullYear()}`
}

function parseTransactionDateTime(date, time) {
  if (date.includes('T')) return new Date(date)
  let d, m, y
  if (date.includes('-')) { const p = date.split('-').map(Number); y = p[0]; m = p[1]; d = p[2] }
  else if (date.includes('/')) { const p = date.split('/').map(Number); d = p[0]; m = p[1]; y = p[2] }
  const [hh, mi, ss] = (time ?? '').split(':').map(Number)
  // Local AR (UTC-3): instant en UTC = local + 3h
  return new Date(Date.UTC(y, m - 1, d, hh ?? 0, mi ?? 0, ss ?? 0) + 3 * 60 * 60_000)
}

async function getValidToken() {
  const { data: rows, error } = await supabase.rpc('bistro_get_credentials', { p_tenant_id: TENANT_ID })
  if (error) throw new Error('RPC bistro_get_credentials: ' + error.message)
  const creds = rows?.[0]
  if (!creds?.username || !creds?.password) throw new Error('Sin credenciales')

  const expiresAt = creds.last_token_expires_at ? new Date(creds.last_token_expires_at) : null
  if (creds.last_token && expiresAt && expiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return creds.last_token
  }

  const res = await fetch(`${BISTRO_API_BASE}/api/v2/Token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: creds.username, password: creds.password }),
  })
  if (!res.ok) throw new Error(`Token HTTP ${res.status}`)
  const body = await res.json()
  await supabase.rpc('bistro_update_token', {
    p_tenant_id: TENANT_ID,
    p_token: body.token,
    p_expires_at: body.expiration,
  })
  return body.token
}

async function fetchTransactions(token, { from, to, page }) {
  const qs = new URLSearchParams({
    From: formatDateForBistro(from),
    To: formatDateForBistro(to),
    Page: String(page),
    Limit: String(PAGE_LIMIT),
  })
  const res = await fetch(`${BISTRO_API_BASE}/api/v2/TransactionDetailReport?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API HTTP ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

async function upsertTransaction(tx, defaultShopCode) {
  if (!tx.date || !tx.time) return { skipped: true }
  const fechaHora = parseTransactionDateTime(tx.date, tx.time)
  const shopCode = tx.shopCode?.trim() || defaultShopCode

  const payload = {
    tenant_id: TENANT_ID,
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
    raw_payload: tx,
    synced_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('bistro_transacciones')
    .upsert(payload, {
      onConflict: 'tenant_id,shop_code,fecha_local,ticket_number,fecha_hora,transaction_type',
    })
    .select('id')
    .single()
  if (error) throw new Error(`Upsert ticket=${tx.ticketNumber} type=${tx.transactionType}: ${error.message}`)

  // Items (replace)
  await supabase.from('bistro_transaccion_items').delete().eq('transaccion_id', data.id)
  const items = (tx.items ?? []).map((it) => ({
    transaccion_id: data.id,
    tenant_id: TENANT_ID,
    item_name: it.item ?? '(sin nombre)',
    sku: it.sku ?? null,
    line_type: it.type ?? 'OTHER',
    amount: it.amount ?? 0,
    quantity: it.quantity ?? 0,
    measure_unit: it.measureUnit ?? null,
    vat: it.vat ?? null,
    comments: it.comments ?? null,
    producto_id: null, // no hago matching en este script — el sync regular lo arreglara
  }))
  if (items.length > 0) {
    const { error: itemsErr } = await supabase.from('bistro_transaccion_items').insert(items)
    if (itemsErr) throw new Error(`Items: ${itemsErr.message}`)
  }
  return { ok: true }
}

async function main() {
  console.log(`Backfill tenant=${TENANT_ID} from=${FROM} to=${TO}`)
  const token = await getValidToken()
  console.log('Token OK')

  const { data: cred } = await supabase
    .from('bistro_credentials')
    .select('shop_code')
    .eq('tenant_id', TENANT_ID)
    .single()
  const defaultShopCode = cred?.shop_code ?? 'default'

  const fromDate = new Date(`${FROM}T00:00:00Z`)
  const toDate = new Date(`${TO}T00:00:00Z`)

  let totalProcessed = 0
  let totalSkipped = 0
  const typeCounter = {}

  const dayCursor = new Date(fromDate)
  while (dayCursor.getTime() <= toDate.getTime()) {
    const dayLabel = fechaArgentina(dayCursor)
    let page = 1
    let hasMore = true
    let dayCount = 0
    while (hasMore) {
      const res = await fetchTransactions(token, { from: dayCursor, to: dayCursor, page })
      for (const tx of res.transactions ?? []) {
        try {
          const r = await upsertTransaction(tx, defaultShopCode)
          if (r.ok) {
            totalProcessed++
            dayCount++
            typeCounter[tx.transactionType] = (typeCounter[tx.transactionType] ?? 0) + 1
          } else {
            totalSkipped++
          }
        } catch (e) {
          console.error(`  ERROR tx ticket=${tx.ticketNumber} type=${tx.transactionType}: ${e.message}`)
        }
      }
      hasMore = res.hasMore
      page++
    }
    console.log(`  ${dayLabel} -> ${dayCount} txs`)
    dayCursor.setUTCDate(dayCursor.getUTCDate() + 1)
  }

  console.log(`\nDONE. processed=${totalProcessed} skipped=${totalSkipped}`)
  console.log('Por tipo:')
  for (const [t, n] of Object.entries(typeCounter).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${t}: ${n}`)
  }
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
