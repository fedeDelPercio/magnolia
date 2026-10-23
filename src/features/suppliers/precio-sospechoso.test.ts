import { describe, expect, it } from 'vitest'

import { avisoPrecioSospechoso, precioSospechoso } from './precio-sospechoso'

describe('precioSospechoso', () => {
  it('una suba o baja normal no avisa', () => {
    expect(precioSospechoso(1000, 1250)).toBeNull()
    expect(precioSospechoso(1000, 700)).toBeNull()
    expect(precioSospechoso(1000, 2900)).toBeNull()
  })

  it('3 veces o más, para arriba o para abajo, avisa', () => {
    expect(precioSospechoso(1145.83, 66666.67)).toMatchObject({ sube: true })
    expect(precioSospechoso(3400, 501.74)).toMatchObject({ sube: false })
    expect(precioSospechoso(1000, 3000)).toMatchObject({ sube: true })
    expect(precioSospechoso(900, 300)).toMatchObject({ sube: false })
  })

  it('sin precio anterior no hay contra qué comparar', () => {
    expect(precioSospechoso(0, 5000)).toBeNull()
    expect(precioSospechoso(5000, 0)).toBeNull()
  })
})

describe('avisoPrecioSospechoso', () => {
  it('dice cuántas veces y sugiere revisar la presentación', () => {
    const aviso = avisoPrecioSospechoso({ nombre: 'Azúcar', anterior: 1145.83, nuevo: 66666.67, unidad: 'kg', conPresentacion: true })
    expect(aviso).toContain('Azúcar')
    expect(aviso).toContain('58 veces más')
    expect(aviso).toContain('presentación')
  })

  it('sin sospecha no hay aviso', () => {
    expect(avisoPrecioSospechoso({ nombre: 'Yerba', anterior: 5000, nuevo: 5600, unidad: 'kg' })).toBeNull()
  })
})
