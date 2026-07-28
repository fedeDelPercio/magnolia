/* eslint-disable */
// Sondeo DIRECTO de la API de Bistrosoft, sin pasar por el sync de la app.
// Sirve para distinguir "nuestro pipeline pierde datos" de "la API no los
// tiene". Se loguea a Supabase como el usuario demo (mismos permisos que la
// app), lee las credenciales Bistro via el mismo RPC que usa el server action,
// pide token y consulta TransactionDetailReport dia por dia.
// NO imprime secretos: solo conteos y el eco de period/shops que devuelve la API.
//
// Uso:  node scripts/bistro-api-probe.mjs 2026-07-24 2026-07-28

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const TENANT_ID = '2eaa43e4-d06d-4568-bcb3-1720587eddac' // Magnolia Demo
const EMAIL = process.env.E2E_EMAIL || 'demo@magnolia.com'
const PASSWORD = process.env.E2E_PASSWORD || 'DemoMagnolia2026!'
const BISTRO_API_BASE = 'https://ar-api.bistrosoft.com'

// --- env ---
const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

// --- credenciales Bistro via Supabase (mismo RPC que la app) ---
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
if (authErr) { console.error('login supabase:', authErr.message); process.exit(1) }

const { data: credsRows, error: rpcErr } = await supabase.rpc('bistro_get_credentials', { p_tenant_id: TENANT_ID })
if (rpcErr) { console.error('rpc:', rpcErr.message); process.exit(1) }
const creds = credsRows?.[0]
if (!creds?.username || !creds?.password) { console.error('sin credenciales'); process.exit(1) }
console.log(`credenciales OK (usuario ${creds.username}, shop_code ${creds.shop_code ?? 'null=todos'})`)

// --- token Bistrosoft ---
const tokenRes = await fetch(`${BISTRO_API_BASE}/api/v2/Token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: creds.username, password: creds.password }),
})
if (!tokenRes.ok) { console.error(`Token HTTP ${tokenRes.status}: ${await tokenRes.text()}`); process.exit(1) }
const { token, expiration } = await tokenRes.json()
console.log(`token OK (expira ${expiration})\n`)

// --- probe por dia ---
const [fromArg, toArg] = process.argv.slice(2)
const from = new Date(`${fromArg || '2026-07-24'}T00:00:00`)
const to = new Date(`${toArg || '2026-07-28'}T00:00:00`)

// La API cambio: ahora exige dd-MM-yyyy (con guiones). El formato viejo con
// barras (dd/MM/yyyy) devuelve 400 INVALID_DATE_FORMAT.
const fmt = (d) =>
  `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`

for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
  const day = fmt(d)
  const qs = new URLSearchParams({ From: day, To: day, Page: '1', Limit: '1000' })
  const url = `${BISTRO_API_BASE}/api/v2/TransactionDetailReport?${qs}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    console.log(`${day}  HTTP ${res.status}  ${(await res.text()).slice(0, 200)}`)
    continue
  }
  const body = await res.json()
  const txs = body.transactions ?? []
  const ventas = txs.filter((t) => (t.transactionType ?? '').startsWith('VENTA') || (t.transactionType ?? '').startsWith('COMANDA'))
  const times = txs.map((t) => t.time).filter(Boolean).sort()
  console.log(
    `${day}  totalCount=${body.totalCount}  tickets=${txs.length}  ventas/comandas=${ventas.length}` +
    `  period=${JSON.stringify(body.period)}  shops=${JSON.stringify(body.shops)}` +
    (times.length ? `  horas=${times[0]}..${times[times.length - 1]}` : ''),
  )
}
