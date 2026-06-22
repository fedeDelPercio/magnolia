import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// Cliente con service role: salta RLS. Usar SOLO en server-side trusted code
// (cron jobs, webhooks autenticados, scripts internos). Nunca exponer a cliente.
// Tener cuidado al usarlo en queries que normalmente filtran por tenant.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL no configurada')
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY no configurada')
  return createSupabaseClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
