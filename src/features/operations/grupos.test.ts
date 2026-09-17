import { describe, expect, it } from 'vitest'
import { esVarianteBase, filaDeProduccion, grupoKey, varianteLabel, varianteOrden } from './grupos'

function fila(
  name: string,
  opts: {
    canal?: string | null
    formato?: string | null
    receta?: boolean
    active?: boolean
  } = {},
) {
  return {
    productos: {
      name,
      concepto_id: 'c1',
      canal: opts.canal ?? null,
      formato: opts.formato ?? null,
      active: opts.active ?? true,
      receta_con_ingredientes: opts.receta ?? false,
    },
  }
}

describe('agrupado de Operación', () => {
  it('todas las variantes de un concepto comparten grupo, menú incluido', () => {
    const base = fila('Quiche').productos
    const menu = fila('Menú Quiche', { formato: 'menu' }).productos
    expect(grupoKey('a', base)).toBe(grupoKey('b', menu))
    expect(grupoKey('a', { ...base, concepto_id: null })).toBe('prod:a')
  })

  it('la base es la variante salón; el menú nunca es base', () => {
    expect(esVarianteBase(fila('Quiche').productos)).toBe(true)
    expect(esVarianteBase(fila('Quiche Delivery', { canal: 'delivery' }).productos)).toBe(false)
    expect(esVarianteBase(fila('Menú Quiche', { formato: 'menu' }).productos)).toBe(false)
  })

  it('ordena la apertura salón, barra, menú', () => {
    const vs = [
      fila('Menú Quiche', { formato: 'menu' }),
      fila('Quiche Delivery', { canal: 'delivery' }),
      fila('Quiche'),
    ].sort((a, b) => varianteOrden(a.productos) - varianteOrden(b.productos))
    expect(vs.map((v) => varianteLabel(v.productos))).toEqual(['Salón', 'Barra', 'Menú'])
  })
})

describe('filaDeProduccion', () => {
  it('producto normal: la producción va a la base', () => {
    const base = fila('Quiche', { receta: true })
    const menu = fila('Menú Quiche', { formato: 'menu', receta: true })
    expect(filaDeProduccion(base, [menu])).toBe(base)
  })

  it('plato del día (receta solo en el menú): va a la variante menú', () => {
    const base = fila('Guiso de Lentejas')
    const barra = fila('Guiso de Lentejas Delivery', { canal: 'delivery' })
    const menu = fila('Menú Guiso de Lentejas', { formato: 'menu', receta: true })
    expect(filaDeProduccion(base, [barra, menu])).toBe(menu)
  })

  it('ignora una variante menú inactiva', () => {
    const base = fila('Qui. Mix de Verduras')
    const menu = fila('Menú Qui. Mix de Verduras', { formato: 'menu', receta: true, active: false })
    expect(filaDeProduccion(base, [menu])).toBe(base)
  })

  it('no redirige a la variante barra aunque tenga receta', () => {
    const base = fila('Tostado')
    const barra = fila('Tostado Delivery', { canal: 'delivery', receta: true })
    expect(filaDeProduccion(base, [barra])).toBe(base)
  })

  it('combo (la base ya es un menú): se queda en la base', () => {
    const base = fila('Menú Qui. Pollo')
    const menu = fila('Menú Menú Qui. Pollo', { formato: 'menu', receta: true })
    expect(filaDeProduccion(base, [menu])).toBe(base)
  })
})
