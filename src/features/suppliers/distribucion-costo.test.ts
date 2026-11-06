import { describe, expect, it } from 'vitest'

import { distribucionDelRango, distribucionPorPeriodo, type CompraParaDistribucion } from './distribucion-costo'

const item = (name: string, qty: number, unit_price: number, iva_rate: number | null = null) => ({
  qty,
  unit_price,
  iva_rate,
  insumos: { name },
})

// desc 10% + IVA 21% => cada $1 neto cuesta $1,089
const COMPRAS: CompraParaDistribucion[] = [
  { id: 'c3', fecha: '2026-10-19', total: 21780 + 500, percepciones: 500, iva_rate: 21, descuento_pct: 10, compra_items: [item('Harina', 20, 1000)] },
  { id: 'c2', fecha: '2026-10-07', total: 10890 + 5967, percepciones: 0, iva_rate: 21, descuento_pct: 10, compra_items: [item('Harina', 10, 1000), item('Aceite', 2, 3000, 10.5)] },
  // carga incompleta: el total es mayor que sus ítems
  { id: 'c1', fecha: '2026-09-30', total: 50000, percepciones: 0, iva_rate: 0, descuento_pct: 0, compra_items: [item('Aceite', 1, 20000)] },
]

describe('distribucionPorPeriodo', () => {
  it('por mes: insumos de mayor a menor, con percepciones, y suma el total', () => {
    const p = distribucionPorPeriodo(COMPRAS, 'mes')
    expect(p.map((x) => x.fecha)).toEqual(['2026-10-01', '2026-09-01'])
    const oct = p[0]!
    expect(oct.compras).toBe(2)
    expect(oct.total).toBeCloseTo(21780 + 500 + 10890 + 5967)
    expect(oct.filas.map((f) => f.nombre)).toEqual(['Harina', 'Aceite', 'Percepciones'])
    expect(oct.filas[0]!.costo).toBeCloseTo(32670)
    expect(oct.filas[1]!.costo).toBeCloseTo(5967)
    expect(oct.filas.reduce((s, f) => s + f.costo, 0)).toBeCloseTo(oct.total)
  })

  it('lo que falta del total va a "Sin detalle de insumos"', () => {
    const sep = distribucionPorPeriodo(COMPRAS, 'mes')[1]!
    expect(sep.filas).toEqual([
      { nombre: 'Sin detalle de insumos', costo: 30000, tipo: 'sin_detalle' },
      { nombre: 'Aceite', costo: 20000, tipo: 'insumo' },
    ])
  })

  it('por compra: una por compra, la más nueva primero', () => {
    const p = distribucionPorPeriodo(COMPRAS, 'compra')
    expect(p.map((x) => x.key)).toEqual(['c3', 'c2', 'c1'])
    expect(p[1]!.filas.map((f) => f.nombre)).toEqual(['Harina', 'Aceite'])
  })

  it('por semana: agrupa lunes a domingo', () => {
    const p = distribucionPorPeriodo(COMPRAS, 'semana')
    expect(p.map((x) => x.fecha)).toEqual(['2026-10-19', '2026-10-05', '2026-09-28'])
  })
})

describe('distribucionDelRango', () => {
  it('todas las compras juntas', () => {
    const d = distribucionDelRango(COMPRAS)
    expect(d.compras).toBe(3)
    expect(d.filas.map((f) => f.nombre)).toEqual(['Harina', 'Sin detalle de insumos', 'Aceite', 'Percepciones'])
    expect(d.filas.reduce((s, f) => s + f.costo, 0)).toBeCloseTo(d.total)
  })
})
