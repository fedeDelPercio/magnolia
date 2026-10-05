// Descuentos sobre el plus mensual (desperdicio u otros faltantes atribuibles
// al empleado). Se acumulan como "pendientes" y se descuentan del próximo plus
// que se paga. Si superan el plus, el plus queda en 0 y lo que sobra se arrastra
// al mes siguiente (ver origen_liquidacion_id en 0079).

export type DescuentoPendiente = {
  id: string
  fecha: string // YYYY-MM-DD
  monto: number
}

export type AplicacionDescuentos = {
  /** Descuentos que se vinculan a esta liquidación. */
  ids: string[]
  /** Suma de esos descuentos. */
  totalDescuentos: number
  /** Lo que efectivamente se resta del plus (nunca más que el plus). */
  aplicado: number
  /** Plus que se paga. */
  plusNeto: number
  /** Lo que no entró en el plus y pasa al mes siguiente. */
  excedente: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Solo cuentan los descuentos con fecha hasta el día en que se paga el plus:
 * uno cargado con fecha posterior queda para el plus siguiente.
 */
export function aplicarDescuentosAlPlus(
  plusBruto: number,
  pendientes: DescuentoPendiente[],
  hastaFecha: string,
): AplicacionDescuentos {
  if (!(plusBruto > 0)) {
    return { ids: [], totalDescuentos: 0, aplicado: 0, plusNeto: Math.max(0, plusBruto || 0), excedente: 0 }
  }
  const aplicables = pendientes.filter((d) => d.fecha <= hastaFecha && Number(d.monto) > 0)
  const totalDescuentos = round2(aplicables.reduce((s, d) => s + Number(d.monto), 0))
  const aplicado = round2(Math.min(totalDescuentos, plusBruto))
  return {
    ids: aplicables.map((d) => d.id),
    totalDescuentos,
    aplicado,
    plusNeto: round2(plusBruto - aplicado),
    excedente: round2(totalDescuentos - aplicado),
  }
}

/** Minutos a "1 h 25 min" / "40 min". */
export function formatMinutos(min: number): string {
  const m = Math.max(0, Math.round(min))
  const h = Math.floor(m / 60)
  const r = m % 60
  if (h === 0) return `${r} min`
  if (r === 0) return `${h} h`
  return `${h} h ${r} min`
}
