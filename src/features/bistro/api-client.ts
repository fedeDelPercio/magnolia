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
    // v2 devuelve "transactions"; v1 devuelve "items".
    transactions: z.array(transactionSchema).nullable().optional(),
    items: z.array(transactionSchema).nullable().optional(),
    // Los metadatos de paginación varían entre versiones; normalizamos en
    // fetchTransactions (hasMore explícito en v2, page<totalPages en v1).
    hasMore: z.boolean().nullable().optional(),
    page: z.number().int().nullable().optional(),
    limit: z.number().int().nullable().optional(),
    pageSize: z.number().int().nullable().optional(),
    records: z.number().int().nullable().optional(),
    totalCount: z.number().int().nullable().optional(),
    totalPages: z.number().int().nullable().optional(),
  })

export type BistroTokenResponse = z.infer<typeof tokenResponseSchema>
export type BistroTransaction = z.infer<typeof transactionSchema>
export type BistroLine = z.infer<typeof lineSchema>
// Forma normalizada que devuelve fetchTransactions, sin importar la versión.
export type BistroTransactionsResponse = Omit<
  z.infer<typeof transactionsResponseSchema>,
  'transactions' | 'hasMore'
> & {
  transactions: BistroTransaction[]
  hasMore: boolean
}

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

function fmtSlash(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function fmtIso(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// Combinaciones de nombre de parámetro + formato de fecha que probamos contra
// el TransactionDetailReport hasta encontrar la que la versión vigente de la
// API entiende (Bistrosoft cambió de versión sin publicar documentación).
type Dialect = { fromKey: string; toKey: string; fmt: (d: Date) => string }
const DIALECTS: Dialect[] = [
  { fromKey: 'From', toKey: 'To', fmt: formatDateForBistro },
  { fromKey: 'From', toKey: 'To', fmt: fmtSlash },
  { fromKey: 'From', toKey: 'To', fmt: fmtIso },
  { fromKey: 'DateFrom', toKey: 'DateTo', fmt: formatDateForBistro },
  { fromKey: 'DateFrom', toKey: 'DateTo', fmt: fmtSlash },
  { fromKey: 'DateFrom', toKey: 'DateTo', fmt: fmtIso },
  { fromKey: 'StartDate', toKey: 'EndDate', fmt: fmtIso },
  { fromKey: 'StartDate', toKey: 'EndDate', fmt: fmtSlash },
  { fromKey: 'fechaDesde', toKey: 'fechaHasta', fmt: fmtSlash },
  { fromKey: 'fechaDesde', toKey: 'fechaHasta', fmt: fmtIso },
]
let discoveredDialect: number | null = null
// Si la batería completa ya corrió sin éxito en esta ejecución, no la
// repetimos por cada día vacío: la API rate-limitea (429) ante ráfagas.
let discoveryExhausted = false

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
  // La v1 respondió 200 con totalCount=0 para días con datos e ignoró
  // nuestro Limit (pageSize quedó en su default 5000), así que además del
  // formato de fecha probamos distintos NOMBRES de parámetro. El primer
  // dialecto que devuelva transacciones queda cacheado para el resto de la
  // ejecución (module-level: sobrevive dentro de la misma lambda).
  let lastError: BistroApiError | null = null
  let lastEmpty: (BistroTransactionsResponse & { rawSample?: string }) | null = null

  const intentar = async (
    version: string,
    dialect: Dialect,
  ): Promise<(BistroTransactionsResponse & { rawSample?: string }) | 'version_failed' | null> => {
    const qs = new URLSearchParams()
    qs.set(dialect.fromKey, dialect.fmt(params.from))
    qs.set(dialect.toKey, dialect.fmt(params.to))
    // Paginación bajo varios nombres a la vez: los desconocidos se ignoran.
    if (params.page) {
      qs.set('Page', String(params.page))
      qs.set('page', String(params.page))
    }
    if (params.limit) {
      qs.set('Limit', String(params.limit))
      qs.set('pageSize', String(params.limit))
    }
    if (params.shopCodes?.length) {
      qs.set('ShopCodes', params.shopCodes.join(','))
      qs.set('ShopCode', params.shopCodes[0]!)
    }
    if (params.transactionType) qs.set('TransactionType', params.transactionType)
    if (params.origin) qs.set('Origin', params.origin)

    const res = await fetch(`${BISTRO_API_BASE}/api/${version}/TransactionDetailReport?${qs.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })

    if (!res.ok) {
      const { message, code } = await parseErrorBody(res)
      lastError = new BistroApiError(message, res.status, code)
      if (code === 'UnsupportedApiVersion' || res.status === 401) return 'version_failed'
      throw lastError
    }

    const json: unknown = await res.json()
    const parsed = transactionsResponseSchema.parse(json)
    const transactions = parsed.transactions ?? parsed.items ?? []
    const totalPages = parsed.totalPages ?? 1
    const normalized: BistroTransactionsResponse = {
      ...parsed,
      transactions,
      hasMore: parsed.hasMore ?? (params.page ?? 1) < totalPages,
    }
    if (transactions.length > 0) return normalized
    lastEmpty = {
      ...normalized,
      rawSample: `${JSON.stringify(json).slice(0, 400)} · qs: ${qs.toString().slice(0, 200)}`,
    }
    return null
  }

  for (const version of TOKEN_API_VERSIONS) {
    // Con dialecto conocido (o batería ya agotada sin éxito) un solo intento.
    if (discoveredDialect !== null || discoveryExhausted) {
      const r = await intentar(version, DIALECTS[discoveredDialect ?? 0]!)
      if (r === 'version_failed') continue
      if (r !== null) return r
      return lastEmpty! // vacío con dialecto conocido = día sin datos
    }

    for (let i = 0; i < DIALECTS.length; i++) {
      const r = await intentar(version, DIALECTS[i]!)
      if (r === 'version_failed') break // probar la otra versión
      if (r !== null) {
        discoveredDialect = i
        return r
      }
    }
    if (lastEmpty) {
      discoveryExhausted = true
      return lastEmpty
    }
  }

  throw lastError ?? new BistroApiError('TransactionDetailReport sin versiones disponibles', 400)
}
