export type CalcEmpleado = {
  sueldo_diario: number
  plus_mensual: number
}

export type CalcHorario = {
  dow: number
}

export type CalcVacacion = {
  fecha_desde: string
  fecha_hasta: string
}

export type CalcAusencia = {
  fecha: string
  paga: boolean
}

export type LiquidacionInput = {
  empleado: CalcEmpleado
  horarios: CalcHorario[]
  vacaciones: CalcVacacion[]
  ausencias: CalcAusencia[]
  fecha_desde: string // YYYY-MM-DD
  fecha_hasta: string // YYYY-MM-DD
  incluir_plus: boolean
}

export type LiquidacionResult = {
  dias_programados: number
  dias_trabajados: number
  dias_ausentes_pagos: number
  monto_sueldo: number
  monto_plus: number
  monto_total: number
  /** Días pagados = trabajados + vacaciones + ausencias pagas. */
  dias_pagados: number
  /** Diagnóstico opcional: detalle día por día. */
  detalle: Array<{
    fecha: string
    programado: boolean
    estado: 'trabajado' | 'vacaciones' | 'ausente_pago' | 'ausente_no_pago' | 'no_programado'
    paga: boolean
  }>
}

function parseISODate(s: string): Date {
  // Parsear como local para evitar shift de timezone (igual que pago-dialog y otros lugares).
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y!, m! - 1, d!)
}

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function daysInRange(from: string, to: string): string[] {
  const fromD = parseISODate(from)
  const toD = parseISODate(to)
  const out: string[] = []
  const cur = new Date(fromD)
  while (cur <= toD) {
    out.push(toISO(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return out
}

function isDateInVacaciones(fecha: string, vacaciones: CalcVacacion[]): boolean {
  return vacaciones.some((v) => fecha >= v.fecha_desde && fecha <= v.fecha_hasta)
}

function findAusencia(fecha: string, ausencias: CalcAusencia[]): CalcAusencia | undefined {
  return ausencias.find((a) => a.fecha === fecha)
}

/**
 * Calcula la liquidación de un empleado en un rango de fechas.
 *
 * Reglas:
 *   1. Día programado = existe un horario para ese dow.
 *   2. Vacaciones siempre se pagan (no descuentan).
 *   3. Ausencias con `paga=true` se pagan; con `paga=false` no.
 *   4. Plus se prorratea: plus_mensual × (diasPeriodo / diasMesCalendarioDelDesde).
 *      Si el período abarca más de un mes, usamos los días reales del rango contra 30.
 */
export function calcularLiquidacion(input: LiquidacionInput): LiquidacionResult {
  const { empleado, horarios, vacaciones, ausencias, fecha_desde, fecha_hasta, incluir_plus } = input
  const dowSet = new Set(horarios.map((h) => h.dow))
  const days = daysInRange(fecha_desde, fecha_hasta)

  let diasProgramados = 0
  let diasTrabajados = 0
  let diasAusentesPagos = 0
  let diasPagados = 0
  const detalle: LiquidacionResult['detalle'] = []

  for (const fecha of days) {
    const dow = parseISODate(fecha).getDay()
    const programado = dowSet.has(dow)
    if (!programado) {
      detalle.push({ fecha, programado: false, estado: 'no_programado', paga: false })
      continue
    }
    diasProgramados++

    if (isDateInVacaciones(fecha, vacaciones)) {
      diasPagados++
      detalle.push({ fecha, programado: true, estado: 'vacaciones', paga: true })
      continue
    }

    const ausencia = findAusencia(fecha, ausencias)
    if (ausencia) {
      if (ausencia.paga) {
        diasAusentesPagos++
        diasPagados++
        detalle.push({ fecha, programado: true, estado: 'ausente_pago', paga: true })
      } else {
        detalle.push({ fecha, programado: true, estado: 'ausente_no_pago', paga: false })
      }
      continue
    }

    diasTrabajados++
    diasPagados++
    detalle.push({ fecha, programado: true, estado: 'trabajado', paga: true })
  }

  const monto_sueldo = diasPagados * empleado.sueldo_diario

  let monto_plus = 0
  if (incluir_plus && empleado.plus_mensual > 0) {
    // Prorrateo: días del período / días del mes calendario del fecha_desde.
    const desde = parseISODate(fecha_desde)
    const diasMes = new Date(desde.getFullYear(), desde.getMonth() + 1, 0).getDate()
    const factor = Math.min(1, days.length / diasMes)
    monto_plus = Math.round(empleado.plus_mensual * factor * 100) / 100
  }

  return {
    dias_programados: diasProgramados,
    dias_trabajados: diasTrabajados,
    dias_ausentes_pagos: diasAusentesPagos,
    monto_sueldo: Math.round(monto_sueldo * 100) / 100,
    monto_plus,
    monto_total: Math.round((monto_sueldo + monto_plus) * 100) / 100,
    dias_pagados: diasPagados,
    detalle,
  }
}
