import { formatCurrency } from '@/lib/format'

// Un precio por unidad 3 veces más alto o más bajo que el último casi nunca es
// una suba o una oferta: es una cantidad cargada en otra unidad (pack en vez de
// kg, frasco en vez de gramos) o un despiece mal armado. Casos reales: azúcar a
// $66.666 el kg (se tipeó 0,01 pack), mermelada a $3.049 el gramo (1 frasco
// cargado como 1 g), pata muslo a $500 (el cajón se despiezaba x6). Antes de
// guardar una línea así se pide confirmar.
export const FACTOR_SOSPECHOSO = 3

export function precioSospechoso(anterior: number, nuevo: number): { veces: number; sube: boolean } | null {
  if (!(anterior > 0) || !(nuevo > 0)) return null
  const ratio = nuevo / anterior
  if (ratio >= FACTOR_SOSPECHOSO) return { veces: ratio, sube: true }
  if (ratio <= 1 / FACTOR_SOSPECHOSO) return { veces: 1 / ratio, sube: false }
  return null
}

export function avisoPrecioSospechoso(opts: {
  nombre: string
  anterior: number
  nuevo: number
  unidad: string
  conPresentacion?: boolean
}): string | null {
  const s = precioSospechoso(opts.anterior, opts.nuevo)
  if (!s) return null
  const veces = s.veces.toLocaleString('es-AR', { maximumFractionDigits: s.veces < 10 ? 1 : 0 })
  return (
    `${opts.nombre}: da ${formatCurrency(opts.nuevo)} por ${opts.unidad} y la última vez fue ` +
    `${formatCurrency(opts.anterior)} (${veces} veces ${s.sube ? 'más' : 'menos'}). Revisá la cantidad` +
    (opts.conPresentacion ? ' y si está en la presentación o en la unidad suelta.' : ' y la unidad.')
  )
}
