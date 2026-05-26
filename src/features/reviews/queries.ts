import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'
import type { StoredReview } from './google-places'

export const KEY_GOOGLE_PLACE_ID = 'google_place_id'
export const KEY_GOOGLE_PLACE_NAME = 'google_place_name'

export type Snapshot = {
  id: string
  place_id: string
  fetched_at: string
  rating: number
  total_reviews: number
  latest_reviews: StoredReview[]
}

export type ReviewsSummary = {
  placeId: string | null
  placeName: string | null
  rating: number | null
  totalReviews: number | null
  ratingDelta: number | null
  newReviewsCount: number | null
  /** Puntos para sparkline ordenados ASC por fetched_at. */
  sparkline: Array<{ t: string; rating: number }>
  /** Hasta 5 reviews más recientes del snapshot actual. */
  latestReviews: StoredReview[]
  lastFetchedAt: string | null
}

export async function getGooglePlaceId(): Promise<string | null> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data } = await supabase
    .from('tenant_config')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', KEY_GOOGLE_PLACE_ID)
    .maybeSingle()
  if (!data) return null
  const val = data.value
  return typeof val === 'string' && val.length > 0 ? val : null
}

export async function getGooglePlaceName(): Promise<string | null> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const { data } = await supabase
    .from('tenant_config')
    .select('value')
    .eq('tenant_id', tenantId)
    .eq('key', KEY_GOOGLE_PLACE_NAME)
    .maybeSingle()
  if (!data) return null
  const val = data.value
  return typeof val === 'string' && val.length > 0 ? val : null
}

export async function getLatestSnapshot(placeId?: string | null): Promise<Snapshot | null> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  let query = supabase
    .from('google_review_snapshots')
    .select('id, place_id, fetched_at, rating, total_reviews, latest_reviews')
    .eq('tenant_id', tenantId)
    .order('fetched_at', { ascending: false })
    .limit(1)

  if (placeId) query = query.eq('place_id', placeId)

  const { data, error } = await query.maybeSingle()
  if (error || !data) return null
  return {
    ...data,
    rating: Number(data.rating),
    latest_reviews: (data.latest_reviews as StoredReview[]) ?? [],
  }
}

/**
 * Resumen para la card del dashboard.
 *
 * - `rating` y `totalReviews` salen del snapshot más reciente.
 * - Los deltas se calculan contra el snapshot anterior al inicio del período
 *   (no requiere `from`/`to` largos para tener datos comparables).
 * - El sparkline son los snapshots desde `from` hasta hoy (rating vs tiempo).
 */
export async function getReviewsSummary(from: string, _to: string): Promise<ReviewsSummary> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const placeId = await getGooglePlaceId()
  const placeName = await getGooglePlaceName()

  const empty: ReviewsSummary = {
    placeId,
    placeName,
    rating: null,
    totalReviews: null,
    ratingDelta: null,
    newReviewsCount: null,
    sparkline: [],
    latestReviews: [],
    lastFetchedAt: null,
  }

  if (!placeId) return empty

  const latest = await getLatestSnapshot(placeId)
  if (!latest) return empty

  // Snapshot más antiguo cuyo fetched_at sea ≤ from (= baseline para el delta).
  const fromIso = new Date(`${from}T00:00:00Z`).toISOString()
  const { data: baselineData } = await supabase
    .from('google_review_snapshots')
    .select('rating, total_reviews, fetched_at')
    .eq('tenant_id', tenantId)
    .eq('place_id', placeId)
    .lt('fetched_at', fromIso)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const baseline = baselineData
    ? {
        rating: Number(baselineData.rating),
        total_reviews: baselineData.total_reviews as number,
      }
    : null

  const ratingDelta = baseline ? Number((latest.rating - baseline.rating).toFixed(2)) : null
  const newReviewsCount = baseline ? latest.total_reviews - baseline.total_reviews : null

  // Sparkline: todos los snapshots del período actual.
  const { data: sparklineData } = await supabase
    .from('google_review_snapshots')
    .select('fetched_at, rating')
    .eq('tenant_id', tenantId)
    .eq('place_id', placeId)
    .gte('fetched_at', fromIso)
    .order('fetched_at', { ascending: true })

  const sparkline = (sparklineData ?? []).map((r) => ({
    t: r.fetched_at as string,
    rating: Number(r.rating),
  }))

  return {
    placeId,
    placeName,
    rating: latest.rating,
    totalReviews: latest.total_reviews,
    ratingDelta,
    newReviewsCount,
    sparkline,
    latestReviews: latest.latest_reviews,
    lastFetchedAt: latest.fetched_at,
  }
}
