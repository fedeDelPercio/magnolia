import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

export type BistroCredentialsMeta = {
  username: string
  shopCode: string | null
  hasPassword: boolean
  lastTokenExpiresAt: string | null
  updatedAt: string
}

export type BistroSyncRun = {
  id: string
  startedAt: string
  finishedAt: string | null
  rangeFrom: string
  rangeTo: string
  shopCodes: string[] | null
  status: 'running' | 'ok' | 'error'
  transactionsInserted: number
  transactionsUpdated: number
  pagesFetched: number
  unmappedItemsCount: number
  errorMessage: string | null
}

export async function getBistroCredentialsMeta(): Promise<BistroCredentialsMeta | null> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data } = await supabase
    .from('bistro_credentials')
    .select('username, shop_code, password_secret_id, last_token_expires_at, updated_at')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (!data) return null
  return {
    username: data.username,
    shopCode: data.shop_code,
    hasPassword: data.password_secret_id !== null,
    lastTokenExpiresAt: data.last_token_expires_at,
    updatedAt: data.updated_at,
  }
}

export async function getRecentSyncRuns(limit = 5): Promise<BistroSyncRun[]> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()

  const { data } = await supabase
    .from('bistro_sync_runs')
    .select(
      'id, started_at, finished_at, range_from, range_to, shop_codes, status, transactions_inserted, transactions_updated, pages_fetched, unmapped_items_count, error_message',
    )
    .eq('tenant_id', tenantId)
    .order('started_at', { ascending: false })
    .limit(limit)

  return (data ?? []).map((r) => ({
    id: r.id,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    rangeFrom: r.range_from,
    rangeTo: r.range_to,
    shopCodes: r.shop_codes,
    status: r.status as 'running' | 'ok' | 'error',
    transactionsInserted: r.transactions_inserted,
    transactionsUpdated: r.transactions_updated,
    pagesFetched: r.pages_fetched,
    unmappedItemsCount: r.unmapped_items_count,
    errorMessage: r.error_message,
  }))
}
