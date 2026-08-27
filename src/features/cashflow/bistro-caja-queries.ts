import { createClient } from '@/lib/supabase/server'
import { fetchAllPaged } from '@/lib/supabase/paginate'
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
  // Dias del mes sin transacciones de la API cuyos numeros se tomaron del
  // cierre cargado por PDF (Bistrosoft a veces publica tarde).
  diasPdf: string[]
  saldoFinalFuente: 'bistro' | 'pdf' | null
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

  // bistro_transacciones puede tener miles de rows por mes (cada COMANDA es 1 row).
  // Paginar para superar el limite default de 1000 de Supabase.
  const rows = await fetchAllPaged((rangeFrom, rangeTo) =>
    supabase
      .from('bistro_transacciones')
      .select('id, fecha_hora, fecha_local, transaction_type, payment_method, amount_total, user_name, comments')
      .eq('tenant_id', tenantId)
      .gte('fecha_local', from)
      .lt('fecha_local', nextMonth)
      .order('fecha_hora', { ascending: true })
      .range(rangeFrom, rangeTo),
  )

  // NOTA: no descontamos ingresos manuales a caja mayor con origen='caja_efectivo'
  // del cambio neto porque los retiros por cierre ya vienen del propio Bistro
  // (transaction_type='RETIRO' con comments='RETIRO POR CIERRE - ...') y el
  // cron los mueve automaticamente a caja mayor. Restar el manual dobla el
  // descuento. traspasosACajaMayor queda en 0 en este summary.
  const traspasosACajaMayor = 0

  // Cierres cargados por PDF: respaldo para los dias que la API todavia no
  // publico. Solo source='pdf' porque los cierres source='api' traen
  // efectivo_apertura/cierre y retiros en 0 (no son confiables para caja).
  const { data: cierresPdf } = await supabase
    .from('cierres_caja')
    .select('fecha_cierre_local, efectivo_apertura, efectivo_cierre, monto_efectivo, total_retiros, total_depositos')
    .eq('tenant_id', tenantId)
    .eq('source', 'pdf')
    .gte('fecha_cierre_local', from)
    .lt('fecha_cierre_local', nextMonth)
    .order('fecha_cierre_local', { ascending: true })

  if (rows.length === 0 && (cierresPdf ?? []).length === 0) {
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
      diasPdf: [],
      saldoFinalFuente: null,
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

  // Merge de dias tomados del PDF: solo si ese dia NO tiene transacciones de
  // la API (cuando la API se ponga al dia, pisa al PDF automaticamente).
  // Ademas, si el cierre PDF es mas nuevo que el ultimo CIERRE DE CAJA del
  // feed, su efectivo_cierre pasa a ser el saldo real.
  const fechasConTransacciones = new Set(rows.map((r) => r.fecha_local).filter(Boolean))
  const diasPdf: string[] = []
  let saldoFinalFuente: 'bistro' | 'pdf' | null = saldoFinal !== null ? 'bistro' : null
  for (const c of cierresPdf ?? []) {
    const fecha = c.fecha_cierre_local
    if (!fecha) continue
    if (!fechasConTransacciones.has(fecha)) {
      const ventasDia = Number(c.monto_efectivo) || 0
      const retirosDia = Math.abs(Number(c.total_retiros) || 0)
      const depositosDia = Number(c.total_depositos) || 0
      ventasEfectivo += ventasDia
      depositos += depositosDia
      if (retirosDia > 0) {
        retiros += retirosDia
        const motivo = `SEGÚN CIERRE PDF (${fecha.slice(8, 10)}/${fecha.slice(5, 7)})`
        const prev = retirosMap.get(motivo) ?? { total: 0, count: 0 }
        retirosMap.set(motivo, { total: prev.total + retirosDia, count: prev.count + 1 })
      }
      if (!saldoInicialEncontrado) {
        saldoInicial = Number(c.efectivo_apertura) || 0
        saldoInicialEncontrado = true
      }
      diasPdf.push(fecha)
    }
    if (saldoFinalFecha === null || fecha > saldoFinalFecha) {
      saldoFinal = Number(c.efectivo_cierre) || 0
      saldoFinalFecha = fecha
      saldoFinalFuente = 'pdf'
    }
  }

  const cambioNeto = ventasEfectivo + depositos - retiros
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
    diasPdf,
    saldoFinalFuente,
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
