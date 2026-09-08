import { describe, it, expect } from 'vitest'
import { adaptV1FlatRows } from './api-client'
import raw from './__fixtures__/reporte-2026-09-07.json'

// Fixture: respuesta cruda de TransactionDetailReport del 07/09/2026, el dia
// en que la clienta detecto la diferencia. Los totales esperados son los del
// PDF de cierre que emitio Bistro ese dia. Incluye el ticket 132857, cobrado
// en dos patas (ONLINE 4.000 + TARJETA 54.400), que era lo que se perdia.
const PDF = { EFECTIVO: 900771, TARJETA: 511770, QR: 585370, ONLINE: 11000, TOTAL: 2008911 }

describe('adaptV1FlatRows', () => {
  it('suma las dos patas de un ticket pagado con dos medios', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txs = adaptV1FlatRows((raw as any).items)
    const ventas = txs.filter((t) =>
      ['VENTA', 'COMANDA', 'VENTA (Multipago)', 'VENTA (Pago parcial)', 'COMANDA (Multipago)', 'COMANDA (Pago parcial)'].includes(
        t.transactionType ?? '',
      ) && t.paymentMethod !== 'CONSUMO EMPLEADO',
    )
    const porMedio: Record<string, number> = {}
    for (const t of ventas) porMedio[t.paymentMethod ?? '?'] = (porMedio[t.paymentMethod ?? '?'] ?? 0) + (t.amount ?? 0)
    expect(porMedio).toEqual({
      EFECTIVO: PDF.EFECTIVO,
      TARJETA: PDF.TARJETA,
      QR: PDF.QR,
      ONLINE: PDF.ONLINE,
    })
    expect(ventas.reduce((s, t) => s + (t.amount ?? 0), 0)).toBe(PDF.TOTAL)
  })

  it('no duplica los productos del ticket con dos pagos', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txs = adaptV1FlatRows((raw as any).items)
    const patas = txs.filter((t) => t.ticketNumber === 132857)
    expect(patas).toHaveLength(2)
    expect(patas.filter((p) => (p.items?.length ?? 0) > 0)).toHaveLength(1)
  })
})
