'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import { BistroApiError, requestToken } from './api-client'
import { syncRange, type SyncRangeResult } from './sync'

function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) throw new Error(`Fecha inválida: ${value}`)
  return new Date(y, m - 1, d)
}

export async function saveBistroCredentials(
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    const username = String(formData.get('username') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const shopCode = String(formData.get('shopCode') ?? '').trim() || undefined

    if (!username) return { error: 'El usuario es obligatorio' }
    if (!password) return { error: 'La contraseña es obligatoria' }

    const supabase = await createClient()
    const { error } = await supabase.rpc('bistro_save_credentials', {
      p_username: username,
      p_password: password,
      p_shop_code: shopCode,
    })
    if (error) return { error: error.message }

    revalidatePath('/config')
    revalidatePath('/operacion/cierres')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function clearBistroCredentials(): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await supabase.rpc('bistro_clear_credentials')
    if (error) return { error: error.message }
    revalidatePath('/config')
    revalidatePath('/operacion/cierres')
    return {}
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function testBistroConnection(): Promise<{
  ok: boolean
  expiresAt?: string
  error?: string
}> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()
    const { data, error } = await supabase.rpc('bistro_get_credentials', {
      p_tenant_id: tenantId,
    })
    if (error) return { ok: false, error: error.message }
    const creds = data?.[0]
    if (!creds?.username || !creds?.password) return { ok: false, error: 'Credenciales no configuradas' }

    const { expiresAt } = await requestToken(creds.username, creds.password)
    return { ok: true, expiresAt: expiresAt.toISOString() }
  } catch (e) {
    if (e instanceof BistroApiError) {
      return { ok: false, error: `Bistrosoft API ${e.status}: ${e.message}` }
    }
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

export async function syncBistroNow(formData: FormData): Promise<SyncRangeResult | { error: string }> {
  try {
    const fromRaw = String(formData.get('from') ?? '')
    const toRaw = String(formData.get('to') ?? '')
    if (!fromRaw || !toRaw) return { error: 'Rango de fechas incompleto' }

    const from = parseISODate(fromRaw)
    const to = parseISODate(toRaw)
    if (from > to) return { error: 'La fecha "desde" debe ser anterior a "hasta"' }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const tenantId = await getActiveTenantId()

    const result = await syncRange(tenantId, { from, to }, user?.id ?? null)

    revalidatePath('/config')
    revalidatePath('/operacion/cierres')
    revalidatePath('/dashboard')
    return result
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}
