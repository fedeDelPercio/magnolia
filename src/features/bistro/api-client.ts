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
  // Campos del modelo PLANO de la API v1 (spec: ar-api.bistrosoft.com/index.html):
  // cada fila es un renglón (pago o producto consumido), sin items anidados.
  hour: z.string().nullable().optional(),
  product: z.string().nullable().optional(),
  quantity: z.number().nullable().optional(),
  unitPrice: z.number().nullable().optional(),
  vat: z.number().nullable().optional(),
  unitCost: z.number().nullable().optional(),
  totalCost: z.number().nullable().optional(),
  sku: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  waiter: z.string().nullable().optional(),
  tableName: z.string().nullable().optional(),
  dinnersQty: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  uuid: z.string().nullable().optional(),
  timestamp: z.string().nullable().optional(),
  shop: z.string().nullable().optional(),
  txClosed: z.string().nullable().optional(),
  txOpened: z.string().nullable().optional(),
  itemAdded: z.string().nullable().optional(),
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

function fmtIso(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
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
    // Puede ser yyyy-MM-dd (v2) o dd-MM-yyyy (v1). Desambiguamos por la
    // longitud del primer segmento: si tiene 4 digitos es el año.
    const parts = date.split('-').map(Number)
    if ((date.split('-')[0] ?? '').length === 4) {
      y = parts[0]
      m = parts[1]
      d = parts[2]
    } else {
      d = parts[0]
      m = parts[1]
      y = parts[2]
    }
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

// ---------------------------------------------------------------------------
// Adaptador del modelo PLANO de la API v1
// ---------------------------------------------------------------------------
// v1 devuelve UNA FILA POR RENGLON: por cada ticket viene una cabecera
// (Venta/Comanda/VENTA_OLD) y N filas "- ITEM" con cada producto. v2 devolvia
// la transaccion con sus items anidados, que es lo que espera el resto del
// pipeline (upsertTransaction, consolidacion de cierres, matching de productos).
// Este adaptador reagrupa lo plano en la forma vieja para no tocar nada de eso.
const V1_HEADER_TYPES = new Set(['VENTA', 'COMANDA', 'VENTA_OLD'])

function v1IsItemRow(t: string): boolean {
  return t.toUpperCase().startsWith('- ITEM')
}

// "CAJA (RETIRO)" -> "RETIRO"; "Venta" -> "VENTA"; una cabecera anulada pasa a
// VOID_BY_BISTRO_OLD, que es como v2 nombraba al contra-asiento (no cuenta como
// venta, igual que su VENTA_OLD original).
function v1NormalizarTipo(raw: string | null | undefined, status: string | null | undefined): string {
  const t = (raw ?? '').trim()
  const caja = /^CAJA\s*\((.+)\)$/i.exec(t)
  if (caja) return caja[1]!.trim().toUpperCase()
  if (status === 'VOID_BY_BISTRO' && V1_HEADER_TYPES.has(t.toUpperCase())) return 'VOID_BY_BISTRO_OLD'
  return t.toUpperCase()
}

export function adaptV1FlatRows(rows: BistroTransaction[]): BistroTransaction[] {
  const out: BistroTransaction[] = []
  const grupos = new Map<string, BistroTransaction[]>()

  for (const r of rows) {
    // Los movimientos de caja vienen con ticketNumber 0 y sin items propios.
    if (!r.ticketNumber) {
      out.push({ ...r, transactionType: v1NormalizarTipo(r.transactionType, r.status), items: [] })
      continue
    }
    const key = `${r.date ?? ''}::${r.ticketNumber}`
    const arr = grupos.get(key)
    if (arr) arr.push(r)
    else grupos.set(key, [r])
  }

  for (const filas of grupos.values()) {
    const cabeceras = filas.filter((f) => V1_HEADER_TYPES.has((f.transactionType ?? '').trim().toUpperCase()))
    const detalle = filas.filter((f) => v1IsItemRow(f.transactionType ?? ''))
    const items: BistroLine[] = detalle.map((it) => ({
      // Los "- ITEM DESCUENTO" son un descuento a nivel ticket (product '-',
      // quantity 0, monto negativo): les damos un nombre reconocible para que
      // no aparezcan como un producto llamado "-".
      item: v1IsItemRow(it.transactionType ?? '') && (it.transactionType ?? '').toUpperCase().includes('DESCUENTO')
        ? 'DESCUENTO'
        : (it.product ?? null),
      amount: it.amount ?? null,
      quantity: it.quantity ?? null,
      type: it.transactionType ?? null,
      measureUnit: null,
      comments: it.comments ?? null,
      sku: it.sku ?? null,
      vat: it.vat ?? null,
    }))

    // El detalle cuelga de la cabecera valida (CLOSE). En un ticket anulado
    // conviven VENTA_OLD + la cabecera anulada; el detalle va al original y el
    // contra-asiento queda sin items, replicando el par que armaba v2.
    const principal = cabeceras.find((h) => h.status === 'CLOSE') ?? cabeceras[0]

    if (!principal) {
      // Defensivo: ticket sin cabecera (no deberia pasar). No perdemos el
      // detalle: lo emitimos como una transaccion propia.
      const base = filas[0]!
      out.push({ ...base, transactionType: 'VENTA', items })
      continue
    }

    for (const h of cabeceras) {
      out.push({
        ...h,
        transactionType: v1NormalizarTipo(h.transactionType, h.status),
        items: h === principal ? items : [],
      })
    }
  }

  return out
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

// Según el spec oficial (https://ar-api.bistrosoft.com/index.html →
// openapi/v1.json): GET /api/v1/TransactionDetailReport con startDate/endDate
// (yyyy-MM-dd), pageNumber (¡la primera página es 0!) y shopCode opcional.
// Máximo 500 items por página y 12 requests por minuto (429 al pasarse).
// La respuesta es PLANA: {records, totalPages, pageSize, totalCount, items[]}
// donde cada item es un renglón (pago o producto), sin items anidados como v2.
export async function fetchTransactions(
  token: string,
  params: FetchTransactionsParams,
): Promise<BistroTransactionsResponse & { rawSample?: string; isV1Flat?: boolean }> {
  // endDate es EXCLUSIVO: pidiendo 27→29 la API devuelve el 27 y el 28. Le
  // sumamos un dia para que el ultimo dia del rango entre.
  const endExclusive = new Date(params.to)
  endExclusive.setDate(endExclusive.getDate() + 1)

  const qs = new URLSearchParams()
  qs.set('startDate', fmtIso(params.from))
  qs.set('endDate', fmtIso(endExclusive))
  qs.set('pageNumber', String((params.page ?? 1) - 1))
  if (params.shopCodes?.length) qs.set('shopCode', params.shopCodes[0]!)

  const res = await fetch(`${BISTRO_API_BASE}/api/v1/TransactionDetailReport?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!res.ok) {
    const { message, code } = await parseErrorBody(res)
    throw new BistroApiError(message, res.status, code)
  }

  const json: unknown = await res.json()
  const parsed = transactionsResponseSchema.parse(json)
  const isV1Flat = parsed.transactions == null && parsed.items != null
  // El modelo plano trae la hora en "hour"; el resto del pipeline espera "time".
  const normalizadas = (parsed.transactions ?? parsed.items ?? []).map((t) => ({
    ...t,
    time: t.time ?? t.hour ?? null,
  }))
  // v1 viene plano (una fila por renglon): lo reagrupamos a la forma de v2.
  const transactions = isV1Flat ? adaptV1FlatRows(normalizadas) : normalizadas
  const totalPages = parsed.totalPages ?? 1
  return {
    ...parsed,
    transactions,
    hasMore: parsed.hasMore ?? (params.page ?? 1) < totalPages,
    isV1Flat,
    rawSample:
      transactions.length === 0 ? `${JSON.stringify(json).slice(0, 400)} · qs: ${qs.toString()}` : undefined,
  }
}
