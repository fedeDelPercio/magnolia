import { describe, expect, it } from 'vitest'

import { enLaVentana, enVentana, restarDias } from './ventana'

describe('restarDias', () => {
  it('cruza meses y años', () => {
    expect(restarDias('2026-11-06', 30)).toBe('2026-10-07')
    expect(restarDias('2026-11-06', 90)).toBe('2026-08-08')
    expect(restarDias('2026-11-06', 365)).toBe('2025-11-06')
    expect(restarDias('2026-03-01', 1)).toBe('2026-02-28')
  })
})

describe('enVentana', () => {
  const compras = [
    { fecha: '2025-10-01' },
    { fecha: '2026-08-07' },
    { fecha: '2026-08-08' },
    { fecha: '2026-10-07' },
    { fecha: '2026-11-06' },
  ]
  const hoy = '2026-11-06'

  it('1 mes, 90 días y 1 año cuentan desde hoy, inclusive', () => {
    expect(enVentana(compras, '30', hoy).map((c) => c.fecha)).toEqual(['2026-10-07', '2026-11-06'])
    expect(enVentana(compras, '90', hoy).map((c) => c.fecha)).toEqual(['2026-08-08', '2026-10-07', '2026-11-06'])
    expect(enVentana(compras, '365', hoy)).toHaveLength(4)
  })

  it('todo no filtra', () => {
    expect(enVentana(compras, 'todo', hoy)).toHaveLength(5)
  })
})

describe('enLaVentana', () => {
  it('frase para avisos', () => {
    expect(enLaVentana('30')).toBe('el último mes')
    expect(enLaVentana('90')).toBe('los últimos 90 días')
    expect(enLaVentana('365')).toBe('el último año')
    expect(enLaVentana('todo')).toBe('todo el historial')
  })
})
