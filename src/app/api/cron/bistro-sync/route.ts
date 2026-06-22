import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncRange } from '@/features/bistro/sync'

// Vercel cron: corre diariamente a las 6am Argentina (9 UTC). Sincroniza el
// dia anterior (en hora Argentina) para todos los tenants con credenciales
// configuradas en bistro_credentials.
//
// Autenticacion: Vercel manda Authorization: Bearer <CRON_SECRET> cuando la
// env var esta configurada. Sin ella el endpoint queda publico — siempre
// definir CRON_SECRET en produccion.

export const maxDuration = 300 // 5 min — pega varios tenants si hace falta
export const dynamic = 'force-dynamic'

const AR_TZ = 'America/Argentina/Buenos_Aires'

// Devuelve la fecha de ayer en zona Argentina como 'YYYY-MM-DD'.
function yesterdayInArgentina(): string {
  const now = new Date()
  // Fecha de hoy en AR
  const todayAr = now.toLocaleDateString('en-CA', { timeZone: AR_TZ })
  const [y, m, d] = todayAr.split('-').map(Number)
  // Construimos el dia anterior usando UTC para evitar drift por DST
  const ayer = new Date(Date.UTC(y!, m! - 1, d! - 1))
  return ayer.toISOString().slice(0, 10)
}

function dateFromYYYYMMDD(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const auth = request.headers.get('authorization')
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const admin = createAdminClient()

  // Tenants con credenciales — el sync va a fallar internamente si la
  // password ya no es valida, pero no queremos cortar el resto.
  const { data: creds, error: credsErr } = await admin
    .from('bistro_credentials')
    .select('tenant_id, username, shop_code')
  if (credsErr) {
    return NextResponse.json({ error: `DB: ${credsErr.message}` }, { status: 500 })
  }
  if (!creds || creds.length === 0) {
    return NextResponse.json({ ok: true, message: 'No hay tenants con Bistrosoft configurado', synced: [] })
  }

  const ayer = yesterdayInArgentina()
  const ayerDate = dateFromYYYYMMDD(ayer)

  const results: Array<{
    tenantId: string
    username: string
    status: 'ok' | 'error'
    transactionsInserted: number
    transactionsUpdated: number
    pagesFetched: number
    error?: string
  }> = []

  for (const cred of creds) {
    try {
      const result = await syncRange(
        cred.tenant_id,
        { from: ayerDate, to: ayerDate },
        null,
        admin,
      )
      results.push({
        tenantId: cred.tenant_id,
        username: cred.username,
        status: result.status,
        transactionsInserted: result.transactionsInserted,
        transactionsUpdated: result.transactionsUpdated,
        pagesFetched: result.pagesFetched,
        ...(result.errorMessage ? { error: result.errorMessage } : {}),
      })
    } catch (e) {
      results.push({
        tenantId: cred.tenant_id,
        username: cred.username,
        status: 'error',
        transactionsInserted: 0,
        transactionsUpdated: 0,
        pagesFetched: 0,
        error: e instanceof Error ? e.message : 'Error desconocido',
      })
    }
  }

  return NextResponse.json({
    ok: true,
    date: ayer,
    tenants: results.length,
    synced: results,
  })
}
