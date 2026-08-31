import { z } from 'zod'

export const BISTRO_API_BASE = 'https://ar-api.bistrosoft.com'
const AR_TZ_OFFSET_MIN = -180

// La expiración puede venir con distintos nombres según la versión de la API.
const tokenResponseSchema = z.object({
  token: z.string().min(1),
  expiration: z.string().min(1).optional(),
  expirationDate: z.string().min(1).optional(),
  expiresAt: z.string().min(1).optional(),
})

const lineSchema = z.object({
  item: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  type: z.string().nullable().optional(),
  measureUnit: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  vat: z.number().nullable().optional(),
})

const transactionSchema = z.object({
  ticketNumber: z.number().int(),
  date: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  transactionType: z.string().nullable().optional(),
  origin: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  paymentMethod: z.string().nullable().optional(),
  user: z.string().nullable().optional(),
  comments: z.string().nullable().optional(),
  client: z.string().nullable().optional(),
  shopCode: z.string().nullable().optional(),
  items: z.array(lineSchema).nullable().optional(),
})

const transactionsResponseSchema = z.object({
  shops: z
    .array(z.object({ name: z.string().nullable().optional(), code: z.string().nullable().optional() }))
    .nullable()
    .optional(),
  period: z
    .object({ from: z.string().nullable().optional(), to: z.string().nullable().optional() })
    .nullable()
    .optional(),
    transactions: z.array(transactionSchema).nullable().optional(),
    // Los metadatos de paginación pueden variar entre versiones de la API;
    // solo hasMore importa para el loop de sync (default: página única).
    hasMore: z.boolean().nullable().optional(),
    page: z.number().int().nullable().optional(),
    limit: z.number().int().nullable().optional(),
    totalCount: z.number().int().nullable().optional(),
    totalPages: z.number().int().nullable().optional(),
  })
  .transform((o) => ({ ...o, hasMore: o.hasMore ?? false }))

export type BistroTokenResponse = z.infer<typeof tokenResponseSchema>
export type BistroTransaction = z.infer<typeof transactionSchema>
export type BistroLine = z.infer<typeof lineSchema>
export type BistroTransactionsResponse = z.infer<typeof transactionsResponseSchema>

export class BistroApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'BistroApiError'
  }
}

export function formatDateForBistro(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}-${mm}-${yyyy}`
}

// El spec dice "dd/MM/yyyy" + "HH:mm:ss" sin timezone, pero la API real
// puede devolver "yyyy-MM-dd" (o incluso "yyyy-MM-ddTHH:mm:ss..." con T).
// Soportamos los 3 casos. Asumimos AR (UTC-3) cuando no viene timezone.
export function parseTransactionDateTime(date: string, time: string): Date {
  // Si el "date" ya incluye T (ISO completo), parseamos directo
  if (date.includes('T')) {
    const d = new Date(date)
    if (isNaN(d.getTime())) throw new Error(`Invalid Bistro date: ${date}`)
    return d
  }

  let d: number | undefined
  let m: number | undefined
  let y: number | undefined

  if (date.includes('-')) {
    // yyyy-MM-dd
    const parts = date.split('-').map(Number)
    y = parts[0]
    m = parts[1]
    d = parts[2]
  } else if (date.includes('/')) {
    // dd/MM/yyyy
    const parts = date.split('/').map(Number)
    d = parts[0]
    m = parts[1]
    y = parts[2]
  }

  if (!d || !m || !y) throw new Error(`Invalid Bistro date: ${date}`)

  const [hh, mi, ss] = (time ?? '').split(':').map(Number)
  const utcMillis = Date.UTC(y, m - 1, d, hh ?? 0, mi ?? 0, ss ?? 0)
  // Local AR = UTC - 3h → instant en UTC = local + 3h
  return new Date(utcMillis - AR_TZ_OFFSET_MIN * 60_000)
}

async function parseErrorBody(res: Response): Promise<{ message: string; code?: string }> {
  try {
    const body = (await res.json()) as { error?: { message?: string; code?: string } }
    if (body?.error?.message) return { message: body.error.message, code: body.error.code }
  } catch {
    // body no es JSON parseable
  }
  return { message: `HTTP ${res.status} ${res.statusText}` }
}

// Bistrosoft movió el Token de v2 a v1 (ago-2026) sin avisar; probamos en
// orden y si una versión responde UnsupportedApiVersion pasamos a la otra.
const TOKEN_API_VERSIONS = ['v1', 'v2'] as const

export async function requestToken(
  username: string,
  password: string,
): Promise<{ token: string; expiresAt: Date }> {
  let lastError: BistroApiError | null = null

  for (const version of TOKEN_API_VERSIONS) {
    const res = await fetch(`${BISTRO_API_BASE}/api/${version}/Token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      cache: 'no-store',
    })

    if (!res.ok) {
      const { message, code } = await parseErrorBody(res)
      lastError = new BistroApiError(message, res.status, code)
      if (code === 'UnsupportedApiVersion') continue
      throw lastError
    }

    const parsed = tokenResponseSchema.parse(await res.json())
    const rawExpiration = parsed.expiration ?? parsed.expirationDate ?? parsed.expiresAt
    const expiresAt = rawExpiration ? new Date(rawExpiration) : new Date(NaN)
    return {
      token: parsed.token,
      // Si no vino expiración interpretable, cacheamos corto y renovamos en el
      // próximo sync en vez de quedarnos con un token vencido.
      expiresAt: isNaN(expiresAt.getTime()) ? new Date(Date.now() + 30 * 60_000) : expiresAt,
    }
  }

  throw lastError ?? new BistroApiError('Token API sin versiones disponibles', 400)
}

export type FetchTransactionsParams = {
  from: Date
  to: Date
  page?: number
  limit?: number
  shopCodes?: string[]
  transactionType?: string
  origin?: string
}

export async function fetchTransactions(
  token: string,
  params: FetchTransactionsParams,
): Promise<BistroTransactionsResponse & { rawSample?: string }> {
  const qs = new URLSearchParams()
  qs.set('From', formatDateForBistro(params.from))
  qs.set('To', formatDateForBistro(params.to))
  if (params.page) qs.set('Page', String(params.page))
  if (params.limit) qs.set('Limit', String(params.limit))
  if (params.shopCodes?.length) qs.set('ShopCodes', params.shopCodes.join(','))
  if (params.transactionType) qs.set('TransactionType', params.transactionType)
  if (params.origin) qs.set('Origin', params.origin)

  // Igual que el Token: Bistrosoft migró de v2 a v1, y el token de una
  // versión no sirve para la otra (v2 devuelve 401 con token v1). Probamos
  // en el mismo orden que el Token y caemos a la otra versión si responde
  // UnsupportedApiVersion o 401.
  let lastError: BistroApiError | null = null

  for (const version of TOKEN_API_VERSIONS) {
    const res = await fetch(`${BISTRO_API_BASE}/api/${version}/TransactionDetailReport?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      const { message, code } = await parseErrorBody(res)
      lastError = new BistroApiError(message, res.status, code)
      if (code === 'UnsupportedApiVersion' || res.status === 401) continue
      throw lastError
    }

    const json: unknown = await res.json()
    const parsed = transactionsResponseSchema.parse(json)
    if (!parsed.transactions?.length) {
      // Diagnóstico: si la versión de la API cambió la forma de la respuesta,
      // esto nos deja ver qué devolvió realmente (el caller lo loguea).
      return { ...parsed, rawSample: JSON.stringify(json).slice(0, 600) }
    }
    return parsed
  }

  throw lastError ?? new BistroApiError('TransactionDetailReport sin versiones disponibles', 400)
}
