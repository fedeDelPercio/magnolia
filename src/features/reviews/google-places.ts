/**
 * Wrapper sobre Google Places API (New).
 *
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
 *
 * La API requiere un Place ID oficial (formato `ChIJ...`). Cuando el usuario
 * pega una URL de Maps en /config, primero resolvemos la URL a Place ID con
 * `resolvePlaceIdFromUrl()` y después usamos `fetchPlaceDetails()` para traer
 * rating + total + las 5 reviews más recientes.
 */

import { z } from 'zod'

const API_BASE = 'https://places.googleapis.com/v1'

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY
  if (!key) {
    throw new Error(
      'GOOGLE_PLACES_API_KEY no está configurada. Agregala a .env.local para activar la sincronización de reseñas.',
    )
  }
  return key
}

// ────────────────────────────────────────────────────────────────────────────
// Resolución URL → Place ID
// ────────────────────────────────────────────────────────────────────────────

/** Place ID oficial: empieza con "ChI" + base64-like.  */
const PLACE_ID_REGEX = /\b(ChI[A-Za-z0-9_-]{20,})\b/

/** FTID dentro de la URL: `!1s0x95bc9f80bfa1b7df:0x49e3ca1159eb4892`. */
const FTID_REGEX = /!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i

/** Nombre del lugar dentro de la URL: `/maps/place/Magnolia/@...`. */
const PLACE_NAME_REGEX = /\/maps\/place\/([^/@]+)/

/** Coords lat,lng: `@-34.396,-58.738,17z`. */
const COORDS_REGEX = /@(-?\d+\.\d+),(-?\d+\.\d+)/

type PlaceResolution = { placeId: string; displayName: string }

/** Short links de Maps: `maps.app.goo.gl/...` o `goo.gl/maps/...`. */
const SHORT_URL_REGEX = /^https?:\/\/(maps\.app\.goo\.gl|goo\.gl\/maps)/i

/**
 * Sigue los redirects de un short link de Maps hasta obtener la URL larga
 * (la que contiene `/maps/place/...@lat,lng` o el Place ID). Google a veces
 * encadena 2-3 redirects, por eso iteramos.
 */
async function expandShortUrl(url: string): Promise<string> {
  let current = url
  for (let i = 0; i < 5; i++) {
    const res = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MagnoliaBot/1.0)' },
    }).catch(() => null)
    if (!res) break
    const loc = res.headers.get('location')
    if (!loc) {
      // Sin redirect: si el fetch siguió hasta el final, res.url es la final.
      if (res.url && res.url !== current) current = res.url
      break
    }
    current = loc.startsWith('http') ? loc : new URL(loc, current).href
    if (current.includes('/maps/place/') || PLACE_ID_REGEX.test(current)) break
  }
  return current
}

/**
 * Resuelve una URL de Google Maps a Place ID oficial.
 *
 * Estrategia:
 *  0. Si es un short link (maps.app.goo.gl), lo expande siguiendo redirects.
 *  1. Si la URL contiene el Place ID directo (`ChIJ...`), lo devuelve.
 *  2. Si tiene nombre + coords, busca con `places:searchText` + location bias.
 */
export async function resolvePlaceIdFromUrl(mapsUrl: string): Promise<PlaceResolution> {
  if (!mapsUrl || typeof mapsUrl !== 'string') {
    throw new Error('URL vacía')
  }

  // 0. Expandir short links antes de parsear.
  let workingUrl = mapsUrl.trim()
  if (SHORT_URL_REGEX.test(workingUrl)) {
    workingUrl = await expandShortUrl(workingUrl)
  }

  const decoded = (() => {
    try {
      return decodeURIComponent(workingUrl)
    } catch {
      return workingUrl
    }
  })()

  // 1. Place ID directo en la URL
  const directMatch = decoded.match(PLACE_ID_REGEX)
  if (directMatch) {
    const placeId = directMatch[1]!
    const details = await fetchPlaceDetails(placeId, ['id', 'displayName'])
    return { placeId, displayName: details.displayName?.text ?? '—' }
  }

  // 2. Sin Place ID directo → necesitamos nombre + coords para searchText
  const nameMatch = decoded.match(PLACE_NAME_REGEX)
  const coordsMatch = decoded.match(COORDS_REGEX)
  if (!nameMatch || !coordsMatch) {
    throw new Error(
      'No pude identificar el lugar en la URL. Asegurate de copiar la URL desde la página del lugar en Google Maps.',
    )
  }

  const placeName = decodeURIComponent(nameMatch[1]!).replace(/\+/g, ' ')
  const lat = Number(coordsMatch[1])
  const lng = Number(coordsMatch[2])

  const res = await fetch(`${API_BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location',
    },
    body: JSON.stringify({
      textQuery: placeName,
      locationBias: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 500 },
      },
      languageCode: 'es',
      maxResultCount: 5,
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Places searchText falló (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = (await res.json()) as {
    places?: Array<{
      id: string
      displayName?: { text: string }
      location?: { latitude: number; longitude: number }
    }>
  }

  const places = json.places ?? []
  if (places.length === 0) {
    throw new Error('La búsqueda en Google no devolvió resultados para esa URL.')
  }

  // Tomar el lugar más cercano a las coordenadas de la URL (haversine simple).
  const closest = places
    .map((p) => ({
      p,
      dist:
        p.location != null
          ? Math.hypot(p.location.latitude - lat, p.location.longitude - lng)
          : Number.POSITIVE_INFINITY,
    }))
    .sort((a, b) => a.dist - b.dist)[0]!

  // Fallback FTID-aware: si el primero no parece el correcto y tenemos FTID,
  // por ahora confiamos en la cercanía geográfica (más confiable que el FTID
  // post-resolución).
  void decoded.match(FTID_REGEX)

  return {
    placeId: closest.p.id,
    displayName: closest.p.displayName?.text ?? placeName,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Fetch de detalles (rating + total + reviews)
// ────────────────────────────────────────────────────────────────────────────

const reviewSchema = z.object({
  name: z.string().optional(),
  rating: z.number(),
  text: z.object({ text: z.string(), languageCode: z.string().optional() }).optional(),
  originalText: z.object({ text: z.string(), languageCode: z.string().optional() }).optional(),
  authorAttribution: z.object({ displayName: z.string() }).optional(),
  publishTime: z.string().optional(),
  relativePublishTimeDescription: z.string().optional(),
})

const placeDetailsSchema = z.object({
  id: z.string().optional(),
  displayName: z.object({ text: z.string() }).optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  reviews: z.array(reviewSchema).optional(),
})

export type PlaceDetailsRaw = z.infer<typeof placeDetailsSchema>

/** Schema "limpio" que persistimos en la columna `latest_reviews` (jsonb). */
export type StoredReview = {
  name: string
  author: string
  rating: number
  text: string
  publishTime: string | null
  relative: string | null
  languageCode: string | null
}

/**
 * Hace GET /v1/places/{placeId} con FieldMask configurable.
 * El default trae todo lo necesario para snapshot + render de la card.
 */
export async function fetchPlaceDetails(
  placeId: string,
  fields: string[] = ['id', 'displayName', 'rating', 'userRatingCount', 'reviews'],
): Promise<PlaceDetailsRaw> {
  const res = await fetch(`${API_BASE}/places/${encodeURIComponent(placeId)}?languageCode=es`, {
    headers: {
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': fields.join(','),
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Places details falló (${res.status}): ${body.slice(0, 200)}`)
  }

  const json = await res.json()
  return placeDetailsSchema.parse(json)
}

/** Convierte la respuesta cruda en el shape que persistimos en jsonb. */
export function normalizeReviews(raw: PlaceDetailsRaw): StoredReview[] {
  return (raw.reviews ?? []).slice(0, 5).map((r) => ({
    name: r.name ?? '',
    author: r.authorAttribution?.displayName ?? 'Anónimo',
    rating: r.rating,
    text: r.text?.text ?? r.originalText?.text ?? '',
    publishTime: r.publishTime ?? null,
    relative: r.relativePublishTimeDescription ?? null,
    languageCode: r.text?.languageCode ?? r.originalText?.languageCode ?? null,
  }))
}
