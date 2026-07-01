// Calculo unificado de precio bruto (con descuento e IVA) para compras y
// comprobantes. Se usa tanto en la UI (para mostrar el total en vivo) como
// en el server al aplicar un comprobante.
//
// Regla acordada con el usuario:
//   1) neto por linea    = qty * unit_price
//   2) descuento (%)     aplica al neto (mismo % en todas las lineas)
//   3) IVA por linea:    si la linea tiene iva_rate propio se usa; sino usa
//                        el iva_rate global de la compra.
//   4) total_linea       = neto_linea * (1 − descuento/100) * (1 + iva/100)
//
// Todos los valores en pesos, sin redondeo intermedio. El display puede
// redondear al mostrar.

export type PricingLine = {
  qty: number
  unit_price: number
  iva_rate?: number | null
}

export type PricingResult = {
  neto: number              // suma de qty * unit_price
  descuento_monto: number   // neto * descuento_pct/100
  subtotal_descontado: number
  iva_monto: number         // suma de IVA por linea sobre la parte descontada
  total: number             // subtotal_descontado + iva_monto
  lineas: Array<{
    neto: number
    descontado: number
    iva_rate: number
    iva_monto: number
    total: number
  }>
}

export function computePricing(
  lines: PricingLine[],
  ivaRateGlobal: number,
  descuentoPct: number,
): PricingResult {
  const desMul = 1 - descuentoPct / 100
  let neto = 0
  let ivaMonto = 0
  let subtotalDescontado = 0

  const linesOut: PricingResult['lineas'] = lines.map((l) => {
    const netoLinea = (Number(l.qty) || 0) * (Number(l.unit_price) || 0)
    const descontado = netoLinea * desMul
    const ivaRateLinea =
      l.iva_rate === null || l.iva_rate === undefined ? ivaRateGlobal : l.iva_rate
    const ivaLinea = descontado * (ivaRateLinea / 100)
    const totalLinea = descontado + ivaLinea

    neto += netoLinea
    subtotalDescontado += descontado
    ivaMonto += ivaLinea

    return {
      neto: netoLinea,
      descontado,
      iva_rate: ivaRateLinea,
      iva_monto: ivaLinea,
      total: totalLinea,
    }
  })

  return {
    neto,
    descuento_monto: neto - subtotalDescontado,
    subtotal_descontado: subtotalDescontado,
    iva_monto: ivaMonto,
    total: subtotalDescontado + ivaMonto,
    lineas: linesOut,
  }
}
