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
  aperturas: number             // suma de aperturas del mes (efectivo inicial cargado)
  ventasEfectivo: number        // suma de ventas EFECTIVO del mes
  depositos: number             // suma de depositos
  retiros: number               // suma de retiros (valor absoluto)
  cierres: number               // suma de cierres reportados (saldo final efectivo segun Bistro)
  saldoEsperado: number         // aperturas + ventas + depositos - retiros
  diferencia: number            // cierres - saldoEsperado (deberia ser 0 si todo cuadra)
  retirosByMotivo: Array<{ motivo: string; total: number; count: number }>
  movimientos: BistroCajaMovimiento[]
}

// Extrae la categoria del comment de un RETIRO. Carolina los registra con
// formato "CATEGORIA - detalle" (ej: "COMPRA DE INSUMOS - tapas",
// "OTROS - rcm sof"). Si no hay separador devolvemos el comment crudo.
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

  const { data, error } = await supabase
    .from('bistro_transacciones')
    .select('id, fecha_hora, fecha_local, transaction_type, payment_method, amount_total, user_name, comments')
    .eq('tenant_id', tenantId)
    .gte('fecha_local', from)
    .lt('fecha_local', nextMonth)
    .order('fecha_hora', { ascending: true })

  if (error) throw new Error(error.message)
  const rows = data ?? []
  if (rows.length === 0) {
    return {
      hasData: false,
      aperturas: 0,
      ventasEfectivo: 0,
      depositos: 0,
      retiros: 0,
      cierres: 0,
      saldoEsperado: 0,
      diferencia: 0,
      retirosByMotivo: [],
      movimientos: [],
    }
  }

  let aperturas = 0
  let cierres = 0
  let ventasEfectivo = 0
  let retiros = 0
  let depositos = 0
  const retirosMap = new Map<string, { total: number; count: number }>()
  const movimientos: BistroCajaMovimiento[] = []

  for (const r of rows) {
    const amount = Number(r.amount_total) || 0
    const type = r.transaction_type ?? ''
    const method = r.payment_method ?? ''

    if (type === 'APERTURA DE CAJA' || type === 'AJUSTE EN APERTURA DE CAJA') {
      aperturas += amount
      movimientos.push(toMovimiento(r, 'apertura', amount))
    } else if (type === 'CIERRE DE CAJA' || type === 'AJUSTE EN CIERRE CAJA') {
      cierres += amount
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
      // Las ventas individuales no se listan; solo afectan totales.
    }
  }

  const saldoEsperado = aperturas + ventasEfectivo + depositos - retiros
  const diferencia = cierres - saldoEsperado

  const retirosByMotivo = Array.from(retirosMap.entries())
    .map(([motivo, v]) => ({ motivo, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total)

  return {
    hasData: aperturas > 0 || cierres > 0 || retiros > 0 || depositos > 0 || ventasEfectivo > 0,
    aperturas,
    ventasEfectivo,
    depositos,
    retiros,
    cierres,
    saldoEsperado,
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
