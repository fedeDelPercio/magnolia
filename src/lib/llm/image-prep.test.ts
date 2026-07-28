import { describe, it, expect } from 'vitest'
import sharp from 'sharp'

import { extractJpegsFromPdf, unwrapPhoto, renderTiles, renderOverview } from './image-prep'

// Foto sintetica de "factura": grande (por encima del umbral de tiling)
async function makePhoto(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 240, g: 238, b: 230 } },
  })
    .jpeg({ quality: 80 })
    .toBuffer()
}

// PDF minimo estilo "wrapper de foto de telefono": la foto como stream DCTDecode
function wrapInPdf(...jpegs: Buffer[]): Buffer {
  const parts: Buffer[] = [Buffer.from('%PDF-1.4\n')]
  jpegs.forEach((jpeg, i) => {
    parts.push(
      Buffer.from(`${i + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
      jpeg,
      Buffer.from('\nendstream\nendobj\n'),
    )
  })
  parts.push(Buffer.from('%%EOF\n'))
  return Buffer.concat(parts)
}

describe('extractJpegsFromPdf', () => {
  it('extrae la foto JPEG embebida intacta', async () => {
    const jpeg = await makePhoto(1800, 1200)
    const found = extractJpegsFromPdf(wrapInPdf(jpeg))
    expect(found).toHaveLength(1)
    expect(found[0]?.equals(jpeg)).toBe(true)
  })

  it('devuelve vacio si el PDF no tiene JPEGs', () => {
    const fake = Buffer.from('%PDF-1.4\n1 0 obj\n<< >>\nstream\nno soy un jpeg pero ocupo espacio'.padEnd(3000, 'x') + '\nendstream\nendobj\n%%EOF')
    expect(extractJpegsFromPdf(fake)).toHaveLength(0)
  })

  it('extrae multiples fotos de un PDF multi-pagina', async () => {
    const a = await makePhoto(1800, 1200)
    const b = await makePhoto(1600, 1400)
    expect(extractJpegsFromPdf(wrapInPdf(a, b))).toHaveLength(2)
  })
})

describe('unwrapPhoto', () => {
  it('desarma un PDF wrapper y reporta dimensiones', async () => {
    const jpeg = await makePhoto(3200, 2400)
    const photo = await unwrapPhoto(wrapInPdf(jpeg), 'application/pdf')
    expect(photo).not.toBeNull()
    expect(photo!.width).toBe(3200)
    expect(photo!.height).toBe(2400)
  })

  it('rechaza PDFs con varias fotos grandes (multi-pagina)', async () => {
    const a = await makePhoto(3200, 2400)
    const b = await makePhoto(3000, 2200)
    expect(await unwrapPhoto(wrapInPdf(a, b), 'application/pdf')).toBeNull()
  })

  it('acepta imagenes directas grandes', async () => {
    const jpeg = await makePhoto(2400, 1800)
    const photo = await unwrapPhoto(jpeg, 'image/jpeg')
    expect(photo).not.toBeNull()
  })

  it('rechaza imagenes chicas (la API no las reescala, no hace falta mosaico)', async () => {
    const jpeg = await makePhoto(1000, 800)
    expect(await unwrapPhoto(jpeg, 'image/jpeg')).toBeNull()
  })

  it('rechaza mime types no soportados', async () => {
    expect(await unwrapPhoto(Buffer.from('x'), 'image/gif')).toBeNull()
  })
})

describe('renderTiles / renderOverview', () => {
  it('genera una grilla de tiles con solapamiento y todos decodean', async () => {
    const photo = (await unwrapPhoto(await makePhoto(3200, 2400), 'image/jpeg'))!
    const tiles = await renderTiles(photo, 0)
    // 3200/1400 → 3 columnas, 2400/1400 → 2 filas
    expect(tiles).toHaveLength(6)
    for (const t of tiles) {
      const meta = await sharp(t).metadata()
      // cada tile queda cerca del cap de la API (nunca 3x mas grande)
      expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1800)
    }
  })

  it('rota las dimensiones cuando deg = 90', async () => {
    const photo = (await unwrapPhoto(await makePhoto(3200, 1600), 'image/jpeg'))!
    const overview = await renderOverview(photo, 90)
    const meta = await sharp(overview).metadata()
    // la foto apaisada rotada 90 queda vertical
    expect(meta.height!).toBeGreaterThan(meta.width!)
  })

  it('el overview respeta el cap de la API', async () => {
    const photo = (await unwrapPhoto(await makePhoto(4500, 8000), 'image/jpeg'))!
    const overview = await renderOverview(photo, 0)
    const meta = await sharp(overview).metadata()
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1568)
  })
})
