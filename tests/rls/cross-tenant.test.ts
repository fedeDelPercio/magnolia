/**
 * RLS isolation test.
 *
 * Verifies that a user authenticated as tenant A cannot read
 * data belonging to tenant B.
 *
 * Requires SUPABASE_TEST_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 * Run with: vitest run tests/rls
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SERVICE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const skip = !SERVICE_URL || !SERVICE_KEY

describe.skipIf(skip)('RLS: cross-tenant isolation', () => {
  const adminClient = createClient(SERVICE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const emailA = `rls-a-${Date.now()}@test.magnolia`
  const emailB = `rls-b-${Date.now()}@test.magnolia`
  const password = 'Test1234!'

  let tokenA: string
  let tenantBId: string

  beforeAll(async () => {
    // Create user A (triggers handle_new_user → creates tenantA)
    await adminClient.auth.admin.createUser({ email: emailA, password, email_confirm: true })
    // Create user B (triggers handle_new_user → creates tenantB)
    const { data: bData } = await adminClient.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
    })

    // Sign in as A to get token
    const aClient = createClient(SERVICE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '')
    const { data: signIn } = await aClient.auth.signInWithPassword({ email: emailA, password })
    tokenA = signIn.session?.access_token ?? ''

    // Get tenant B id via admin
    if (bData.user) {
      const { data } = await adminClient
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', bData.user.id)
        .single()
      tenantBId = data?.tenant_id ?? ''
    }
  })

  afterAll(async () => {
    // Cleanup: delete test users
    const { data: users } = await adminClient.auth.admin.listUsers()
    for (const u of users.users) {
      if (u.email === emailA || u.email === emailB) {
        await adminClient.auth.admin.deleteUser(u.id)
      }
    }
  })

  it('user A cannot read tenant B data from tenants table', async () => {
    const clientA = createClient(SERVICE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
      global: { headers: { Authorization: `Bearer ${tokenA}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await clientA.from('tenants').select('*').eq('id', tenantBId)

    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('user A cannot read tenant B memberships', async () => {
    const clientA = createClient(SERVICE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
      global: { headers: { Authorization: `Bearer ${tokenA}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data } = await clientA.from('memberships').select('*').eq('tenant_id', tenantBId)

    expect(data).toHaveLength(0)
  })
})
