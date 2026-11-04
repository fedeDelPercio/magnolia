import { describe, expect, it } from 'vitest'

import { groupCostByPeriod, groupPriceByPeriod, groupQtyByPeriod } from './qty-buckets'

describe('groupPriceByPeriod', () => {
  const entries = [
    { fecha: '2026-10-05', unit_price: 1000, qty: 10 }, // lunes
    { fecha: '2026-10-07', unit_price: 2000, qty: 30 }, // misma semana
    { fecha: '2026-10-14', unit_price: 1500, qty: 5 },
    { fecha: '2026-11-02', unit_price: 1800, qty: 2 },
  ]

  it('por semana: promedio ponderado por cantidad', () => {
    const b = groupPriceByPeriod(entries, 'semana')
    expect(b).toHaveLength(3)
    expect(b[0]).toMatchObject({ fecha: '2026-10-05', compras: 2 })
    expect(b[0]!.precio).toBeCloseTo((1000 * 10 + 2000 * 30) / 40)
    expect(b[1]).toMatchObject({ fecha: '2026-10-12', precio: 1500, compras: 1 })
  })

  it('por mes, ordenado y con etiqueta corta para el gráfico', () => {
    const b = groupPriceByPeriod([...entries].reverse(), 'mes')
    expect(b.map((x) => x.fecha)).toEqual(['2026-10-01', '2026-11-01'])
    expect(b[0]!.precio).toBeCloseTo((1000 * 10 + 2000 * 30 + 1500 * 5) / 45)
    expect(b[0]!.chartLabel).toBeTruthy()
  })

  it('sin cantidades usa el promedio simple', () => {
    const b = groupPriceByPeriod([{ fecha: '2026-10-05', unit_price: 100, qty: 0 }, { fecha: '2026-10-06', unit_price: 300, qty: 0 }], 'semana')
    expect(b[0]!.precio).toBe(200)
  })
})

describe('groupQtyByPeriod', () => {
  it('suma la cantidad por semana', () => {
    const b = groupQtyByPeriod([{ fecha: '2026-10-05', qty: 2 }, { fecha: '2026-10-08', qty: 3 }], 'semana')
    expect(b).toEqual([expect.objectContaining({ fecha: '2026-10-05', qty: 5, compras: 2 })])
  })
})

describe('groupCostByPeriod', () => {
  const entries = [
    { fecha: '2026-10-05', costo: 12100, qty: 10 },
    { fecha: '2026-10-07', costo: 6050, qty: 5 },
    { fecha: '2026-11-02', costo: 3000, qty: 2 },
  ]

  it('por semana: suma lo gastado y la cantidad', () => {
    const b = groupCostByPeriod(entries, 'semana')
    expect(b).toHaveLength(2)
    expect(b[0]).toMatchObject({ fecha: '2026-10-05', costo: 18150, qty: 15, compras: 2 })
    expect(b[1]).toMatchObject({ fecha: '2026-11-02', costo: 3000, qty: 2, compras: 1 })
  })

  it('por mes, ordenado', () => {
    const b = groupCostByPeriod([...entries].reverse(), 'mes')
    expect(b.map((x) => [x.fecha, x.costo])).toEqual([['2026-10-01', 18150], ['2026-11-01', 3000]])
    expect(b[0]!.chartLabel).toBeTruthy()
  })
})
