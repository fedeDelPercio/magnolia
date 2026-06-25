import { createClient } from '@/lib/supabase/server'
import { getActiveTenantId } from '@/lib/tenant/server'

// Tipos de transaccion de Bistro que afectan caja en efectivo.
const VENTA_TYPES = new Set([
  'VENTA',
  'VENTA (Multipago)',
  'VENTA (Pago parcial)',
  'COMANDA',
  'COMANDA (Multipago)',
  'COMANDA (Pago parcial)',
])

export type BistroCajaMovimiento = {
  id: string
  fecha_hora: string
  fecha_local: string
  transaction_type: string
  amount: number
  user_name: string | null
  comments: string | null
  // bucket: 'apertura' | 'cierre' | 'venta' | 'retiro' | 'deposito'
  bucket: 'apertura' | 'cierre' | 'venta' | 'retiro' | 'deposito'
}

export type BistroCajaSummary = {
  hasData: boolean
  // Saldos puntuales en el mes
  saldoInicial: number          // primera APERTURA DE CAJA del mes (lo que habia antes de mover nada)
  saldoFinal: number | null     // ultimo CIERRE DE CAJA del mes (null si el mes esta en curso y aun no cerro)
  saldoFinalFecha: string | null
  // Lo que se movio en el mes
  ventasEfectivo: number
  depositos: number
  retiros: number
  traspasosACajaMayor: number
  cambioNeto: number            // ventas + depositos - retiros - traspasos (lo que DEBERIA haber cambiado el saldo)
  // Comparacion vs realidad
  variacionReal: number | null  // saldoFinal - saldoInicial (lo que efectivamente cambio el saldo segun los cierres)
  diferencia: number | null     // variacionReal - cambioNeto (descuadre real del mes; null si todavia no cerro)
  retirosByMotivo: Array<{ motivo: string; total: number; count: number }>
  movimientos: BistroCajaMovimiento[]
}

function motivoFromComment(comment: string | null): string {
  if (!comment) return 'Sin motivo'
  const dashIdx = comment.indexOf(' - ')
  if (dashIdx > 0) return comment.slice(0, dashIdx).trim().toUpperCase()
  return comment.trim().toUpperCase()
}

export async function getBistroCajaMovimientos(month: string): Promise<BistroCajaSummary> {
  const supabase = await createClient()
  const tenantId = await getActiveTenantId()
  const from = `${month}-01`
  const [year, mon] = month.split('-').map(Number)
  const nextMonth = mon === 12 ? `${year! + 1}-01-01` : `${year}-${String(mon! + 1).padStart(2, '0')}-01`

  const [txRes, traspasosRes] = await Promise.all([
    supabase
      .from('bistro_transacciones')
      .select('id, fecha_hora, fecha_local, transaction_type, payment_method, amount_total, user_name, comments')
      .eq('tenant_id', tenantId)
      .gte('fecha_local', from)
      .lt('fecha_local', nextMonth)
      .order('fecha_hora', { ascending: true }),
    // Traspasos del mes que salieron de caja efectivo -> a caja mayor (manual)
    supabase
      .from('caja_mayor_movimientos')
      .select('monto')
      .eq('tenant_id', tenantId)
      .eq('tipo', 'ingreso')
      .eq('origen', 'caja_efectivo')
      .gte('fecha', from)
      .lt('fecha', nextMonth),
  ])

  if (txRes.error) throw new Error(txRes.error.message)
  const rows = txRes.data ?? []
  const traspasosACajaMayor = (traspasosRes.data ?? []).reduce(
    (s, r) => s + (Number(r.monto) || 0),
    0,
  )

  if (rows.length === 0 && traspasosACajaMayor === 0) {
    return {
      hasData: false,
      saldoInicial: 0,
      saldoFinal: null,
      saldoFinalFecha: null,
      ventasEfectivo: 0,
      depositos: 0,
      retiros: 0,
      traspasosACajaMayor: 0,
      cambioNeto: 0,
      variacionReal: null,
      diferencia: null,
      retirosByMotivo: [],
      movimientos: [],
    }
  }

  let ventasEfectivo = 0
  let retiros = 0
  let depositos = 0
  const retirosMap = new Map<string, { total: number; count: number }>()
  const movimientos: BistroCajaMovimiento[] = []

  // Tomamos la PRIMERA apertura del mes y el ULTIMO cierre del mes.
  // Las rows vienen ordenadas por fecha_hora ASC, asi que el primero que
  // encontramos es saldoInicial; vamos sobre-escribiendo saldoFinal hasta
  // procesar todo para quedarnos con el ultimo cierre.
  let saldoInicial = 0
  let saldoInicialEncontrado = false
  let saldoFinal: number | null = null
  let saldoFinalFecha: string | null = null

  for (const r of rows) {
    const amount = Number(r.amount_total) || 0
    const type = r.transaction_type ?? ''
    const method = r.payment_method ?? ''

    if (type === 'APERTURA DE CAJA' || type === 'AJUSTE EN APERTURA DE CAJA') {
      if (!saldoInicialEncontrado) {
        saldoInicial = amount
        saldoInicialEncontrado = true
      }
      movimientos.push(toMovimiento(r, 'apertura', amount))
    } else if (type === 'CIERRE DE CAJA' || type === 'AJUSTE EN CIERRE CAJA') {
      saldoFinal = amount
      saldoFinalFecha = r.fecha_local ?? null
      movimientos.push(toMovimiento(r, 'cierre', amount))
    } else if (type === 'RETIRO') {
      retiros += Math.abs(amount)
      const motivo = motivoFromComment(r.comments)
      const prev = retirosMap.get(motivo) ?? { total: 0, count: 0 }
      retirosMap.set(motivo, { total: prev.total + Math.abs(amount), count: prev.count + 1 })
      movimientos.push(toMovimiento(r, 'retiro', amount))
    } else if (type === 'DEPOSITO') {
      depositos += amount
      movimientos.push(toMovimiento(r, 'deposito', amount))
    } else if (VENTA_TYPES.has(type) && method.toUpperCase() === 'EFECTIVO') {
      ventasEfectivo += amount
    }
  }

  const cambioNeto = ventasEfectivo + depositos - retiros - traspasosACajaMayor
  const variacionReal = saldoFinal !== null ? saldoFinal - saldoInicial : null
  const diferencia = variacionReal !== null ? variacionReal - cambioNeto : null

  const retirosByMotivo = Array.from(retirosMap.entries())
    .map(([motivo, v]) => ({ motivo, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)

  return {
    hasData: true,
    saldoInicial,
    saldoFinal,
    saldoFinalFecha,
    ventasEfectivo,
    depositos,
    retiros,
    traspasosACajaMayor,
    cambioNeto,
    variacionReal,
    diferencia,
    retirosByMotivo,
    movimientos: movimientos.sort((a, b) => b.fecha_hora.localeCompare(a.fecha_hora)),
  }
}

function toMovimiento(
  r: { id: string; fecha_hora: string; fecha_local: string | null; transaction_type: string | null; user_name: string | null; comments: string | null },
  bucket: BistroCajaMovimiento['bucket'],
  amount: number,
): BistroCajaMovimiento {
  return {
    id: r.id,
    fecha_hora: r.fecha_hora,
    fecha_local: r.fecha_local ?? r.fecha_hora.slice(0, 10),
    transaction_type: r.transaction_type ?? '',
    amount,
    user_name: r.user_name,
    comments: r.comments,
    bucket,
  }
}
