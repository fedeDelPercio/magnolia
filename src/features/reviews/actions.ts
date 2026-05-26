'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import {
  fetchPlaceDetails,
  normalizeReviews,
  resolvePlaceIdFromUrl,
} from './google-places'
import { KEY_GOOGLE_PLACE_ID, KEY_GOOGLE_PLACE_NAME, getLatestSnapshot } from './queries'

type Result<T = void> = T extends void
  ? { ok: true } | { ok: false; error: string }
  : { ok: true; data: T } | { ok: false; error: string }

/**
 * Resuelve la URL de Maps a Place ID + nombre, guarda ambos en tenant_config
 * y dispara un primer sync para tener un snapshot inicial.
 */
export async function saveGooglePlaceUrl(
  url: string,
): Promise<Result<{ placeId: string; displayName: string }>> {
  try {
    const trimmed = (url ?? '').trim()
    if (!trimmed) return { ok: false, error: 'Pegá la URL del lugar en Google Maps.' }

    const { placeId, displayName } = await resolvePlaceIdFromUrl(trimmed)

    const supabase = await createClient()
    const tenantId = await getActiveTenantId()
    const { error: e1 } = await supabase.from('tenant_config').upsert(
      [
        { tenant_id: tenantId, key: KEY_GOOGLE_PLACE_ID, value: placeId },
        { tenant_id: tenantId, key: KEY_GOOGLE_PLACE_NAME, value: displayName },
      ],
      { onConflict: 'tenant_id,key' },
    )
    if (e1) return { ok: false, error: e1.message }

    // Primer snapshot — ignoramos error porque ya guardamos el Place ID.
    await syncGoogleReviews({ force: true })

    revalidatePath('/config')
    revalidatePath('/dashboard')
    return { ok: true, data: { placeId, displayName } }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

/**
 * Hace fetch al estado actual del lugar y guarda un snapshot.
 *
 * Idempotente por día: si ya hay un snapshot del mismo día UTC para el Place ID
 * configurado, no hace nada (a menos que `force=true`).
 */
export async function syncGoogleReviews(opts: { force?: boolean } = {}): Promise<Result> {
  try {
    const supabase = await createClient()
    const tenantId = await getActiveTenantId()

    const { data: cfg } = await supabase
      .from('tenant_config')
      .select('value')
      .eq('tenant_id', tenantId)
      .eq('key', KEY_GOOGLE_PLACE_ID)
      .maybeSingle()
    const placeId =
      cfg?.value && typeof cfg.value === 'string' && cfg.value.length > 0 ? cfg.value : null
    if (!placeId) return { ok: false, error: 'No hay Place ID configurado.' }

    if (!opts.force) {
      const latest = await getLatestSnapshot(placeId)
      if (latest && isSameUtcDay(new Date(latest.fetched_at), new Date())) {
        return { ok: true }
      }
    }

    const details = await fetchPlaceDetails(placeId)
    if (typeof details.rating !== 'number' || typeof details.userRatingCount !== 'number') {
      return { ok: false, error: 'Places API no devolvió rating/cantidad.' }
    }

    const { error: insertErr } = await supabase.from('google_review_snapshots').insert({
      tenant_id: tenantId,
      place_id: placeId,
      rating: details.rating,
      total_reviews: details.userRatingCount,
      latest_reviews: normalizeReviews(details),
    })
    if (insertErr) return { ok: false, error: insertErr.message }

    revalidatePath('/dashboard')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error desconocido' }
  }
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  )
}
