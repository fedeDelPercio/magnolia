import { describe, expect, it } from 'vitest'

import { diasQueCorresponden, etiquetaTemporada, sumarDias, temporadaDe, type DiasPorAnio } from './vacaciones-por-anio'

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

describe('temporadas (octubre a septiembre)', () => {
  it('desde octubre arranca la temporada del año siguiente', () => {
    expect(temporadaDe('2026-10-01')).toBe(2027)
    expect(temporadaDe('2026-10-20')).toBe(2027)
    expect(temporadaDe('2026-12-31')).toBe(2027)
  })

  it('hasta septiembre sigue la temporada que termina ese año', () => {
    expect(temporadaDe('2027-01-15')).toBe(2027)
    expect(temporadaDe('2027-09-30')).toBe(2027)
    expect(temporadaDe('2026-09-30')).toBe(2026)
  })

  it('se muestra con los dos años', () => {
    expect(etiquetaTemporada(2027)).toBe('2026-2027')
  })
})

describe('sumarDias (día que vuelve ↔ último día de vacaciones)', () => {
  it('vuelve el 26/10 → el último día es el 25/10', () => {
    expect(sumarDias('2026-10-26', -1)).toBe('2026-10-25')
    expect(sumarDias('2026-10-25', 1)).toBe('2026-10-26')
  })

  it('cruza meses y años', () => {
    expect(sumarDias('2026-11-01', -1)).toBe('2026-10-31')
    expect(sumarDias('2027-01-01', -1)).toBe('2026-12-31')
    expect(sumarDias('2028-02-28', 1)).toBe('2028-02-29')
  })
})
