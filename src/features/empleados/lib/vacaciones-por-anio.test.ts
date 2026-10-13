import { describe, expect, it } from 'vitest'

import { diasQueCorresponden, type DiasPorAnio } from './vacaciones-por-anio'

const filas: DiasPorAnio[] = [
  { empleado_id: 'mayra', anio: 2027, dias: 14 },
  { empleado_id: 'mayra', anio: 2030, dias: 21 },
  { empleado_id: 'otra', anio: 2026, dias: 35 },
]

describe('diasQueCorresponden', () => {
  it('sin nada cargado usa el valor del alta', () => {
    expect(diasQueCorresponden(14, [], 'mayra', 2026)).toBe(14)
  })

  it('los años anteriores al primer cambio quedan con el valor del alta', () => {
    expect(diasQueCorresponden(2, filas, 'mayra', 2026)).toBe(2)
  })

  it('usa lo cargado para ese año', () => {
    expect(diasQueCorresponden(2, filas, 'mayra', 2027)).toBe(14)
    expect(diasQueCorresponden(2, filas, 'mayra', 2030)).toBe(21)
  })

  it('un cambio sigue valiendo para los años siguientes hasta el próximo', () => {
    expect(diasQueCorresponden(2, filas, 'mayra', 2029)).toBe(14)
    expect(diasQueCorresponden(2, filas, 'mayra', 2035)).toBe(21)
  })

  it('no mezcla empleados', () => {
    expect(diasQueCorresponden(7, filas, 'brisa', 2027)).toBe(7)
  })

  it('cero es un valor válido', () => {
    expect(diasQueCorresponden(14, [{ empleado_id: 'x', anio: 2026, dias: 0 }], 'x', 2026)).toBe(0)
  })
})
