/* eslint-disable */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

function loadEnv() {
  const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
    if (m && !line.trim().startsWith('#')) process.env[m[1]] = m[2]
  }
}
loadEnv()

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// Buscar user demo
const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
const demoUser = list.users.find((u) => u.email === 'demo@magnolia.com')
console.log('Demo user:', demoUser?.id)

// Memberships del user demo
const { data: ms } = await admin
  .from('memberships')
  .select('tenant_id, role, status, tenants(name)')
  .eq('user_id', demoUser.id)
console.log('Memberships:', JSON.stringify(ms, null, 2))

// Cierres por tenant
for (const m of ms) {
  const { data, count } = await admin
    .from('cierres_caja')
    .select('id, fecha_cierre, total_vendido', { count: 'exact' })
    .eq('tenant_id', m.tenant_id)
    .order('fecha_cierre', { ascending: true })
    .limit(3)
  const { data: last } = await admin
    .from('cierres_caja')
    .select('fecha_cierre, total_vendido')
    .eq('tenant_id', m.tenant_id)
    .order('fecha_cierre', { ascending: false })
    .limit(1)
  console.log(`\nTenant ${m.tenants.name} (${m.tenant_id}):`)
  console.log(`  Total cierres: ${count}`)
  console.log(`  Primer: ${data?.[0]?.fecha_cierre} = $${data?.[0]?.total_vendido}`)
  console.log(`  Último: ${last?.[0]?.fecha_cierre} = $${last?.[0]?.total_vendido}`)
}

process.exit(0)
