import { describe, expect, it } from 'vitest'
import { aplicarDescuentosAlPlus, formatMinutos } from './descuentos-plus'

const d = (id: string, fecha: string, monto: number) => ({ id, fecha, monto })

describe('aplicarDescuentosAlPlus', () => {
  it('sin descuentos paga el plus entero', () => {
    expect(aplicarDescuentosAlPlus(250000, [], '2026-10-01')).toEqual({
      ids: [],
      totalDescuentos: 0,
      aplicado: 0,
      plusNeto: 250000,
      excedente: 0,
    })
  })

  it('resta los pendientes hasta la fecha de pago', () => {
    const r = aplicarDescuentosAlPlus(
      250000,
      [d('a', '2026-09-10', 12000), d('b', '2026-09-28', 3500.5), d('c', '2026-10-02', 9000)],
      '2026-10-01',
    )
    expect(r.ids).toEqual(['a', 'b'])
    expect(r.aplicado).toBe(15500.5)
    expect(r.plusNeto).toBe(234499.5)
    expect(r.excedente).toBe(0)
  })

  it('si superan el plus, el plus queda en 0 y el resto se arrastra', () => {
    const r = aplicarDescuentosAlPlus(50000, [d('a', '2026-09-10', 40000), d('b', '2026-09-20', 30000)], '2026-10-01')
    expect(r.ids).toEqual(['a', 'b'])
    expect(r.totalDescuentos).toBe(70000)
    expect(r.aplicado).toBe(50000)
    expect(r.plusNeto).toBe(0)
    expect(r.excedente).toBe(20000)
  })

  it('sin plus no aplica nada (los descuentos esperan)', () => {
    const r = aplicarDescuentosAlPlus(0, [d('a', '2026-09-10', 1000)], '2026-10-01')
    expect(r.ids).toEqual([])
    expect(r.plusNeto).toBe(0)
  })
})

describe('formatMinutos', () => {
  it('formatea minutos y horas', () => {
    expect(formatMinutos(40)).toBe('40 min')
    expect(formatMinutos(60)).toBe('1 h')
    expect(formatMinutos(85)).toBe('1 h 25 min')
    expect(formatMinutos(0)).toBe('0 min')
  })
})
