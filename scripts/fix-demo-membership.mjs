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

const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
const demoUser = list.users.find((u) => u.email === 'demo@magnolia.com')
if (!demoUser) {
  console.error('demo@magnolia.com no existe')
  process.exit(1)
}

// Identificar tenant "Magnolia Demo" (el bueno)
const { data: demoTenant } = await admin
  .from('tenants')
  .select('id')
  .eq('name', 'Magnolia Demo')
  .single()

// Borrar todas las memberships del user demo EXCEPTO la del tenant Magnolia Demo
const { data: deleted, error } = await admin
  .from('memberships')
  .delete()
  .eq('user_id', demoUser.id)
  .neq('tenant_id', demoTenant.id)
  .select('tenant_id')

if (error) {
  console.error('Error:', error.message)
  process.exit(1)
}

console.log(`✓ Borradas ${deleted?.length ?? 0} memberships extra`)
console.log('Tenant activo del user demo ahora será: Magnolia Demo')

// Verificar
const { data: ms } = await admin
  .from('memberships')
  .select('tenant_id, tenants(name)')
  .eq('user_id', demoUser.id)
console.log('Memberships restantes:', ms?.map((m) => m.tenants?.name))
