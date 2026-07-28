/**
 * Preprocesado de fotos de comprobantes antes de mandarlas al LLM.
 *
 * Problema que resuelve: la API de Anthropic reescala toda imagen (y toda
 * pagina de PDF) a ~1568px de lado largo antes de que el modelo la vea. Una
 * foto de telefono tipica (4000x8000) llega reducida ~5x y los digitos de una
 * factura impresa quedan de ~8px — el modelo empieza a inventar numeros y a
 * mezclar filas. Encima muchas fotos vienen rotadas 90 grados.
 *
 * Estrategia:
 *  1. Si el archivo es un PDF que solo envuelve una foto JPEG (caso tipico de
 *     apps de escaneo del telefono), extraemos la foto cruda del PDF.
 *  2. Normalizamos la orientacion EXIF.
 *  3. Generamos un mosaico de recortes ("tiles") con solapamiento, cada uno
 *     por debajo del cap de la API, sobre una version ampliada (~2.3x el cap).
 *     El modelo recibe la vista completa + los recortes y lee los numeros de
 *     los recortes.
 *
 * La rotacion del texto (foto sacada de costado) no se detecta aca — eso lo
 * decide una mini-llamada al LLM en claude-vision.ts; este modulo solo aplica
 * los grados que le pidan.
 */

import sharp from 'sharp'

// Lado largo maximo que la API de Anthropic le muestra al modelo.
const API_LONG_EDGE = 1568
// Lado largo efectivo del mosaico: ~2.3x el cap de la API. Mas resolucion =
// mas tiles = mas tokens; este punto alcanza para digitos de factura.
const TARGET_LONG_EDGE = 3600
// Paso del mosaico y solapamiento entre tiles vecinos (para que ninguna fila
// de la factura quede cortada en todos los tiles a la vez). step + 2*overlap
// queda apenas sobre el cap: el reescalado marginal que aplica la API (~3%)
// es despreciable frente al 5x que sufre la foto entera.
const TILE_STEP = 1400
const TILE_OVERLAP = 110
// Por debajo de esto (~1.4x el area que muestra la API) el mosaico no aporta:
// conviene el camino normal de un solo archivo.
const MIN_PIXELS_FOR_TILING = 1_600_000

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type PreparedPhoto = {
  bytes: Buffer
  // Dimensiones ya con la orientacion EXIF aplicada
  width: number
  height: number
}

export type RotationDeg = 0 | 90 | 180 | 270

// Busca streams JPEG (DCTDecode) dentro de un PDF escaneando pares
// stream/endstream — sin libreria de PDF. Funciona para los PDFs "wrapper"
// que generan los telefonos (sin encriptar, con la foto como stream directo).
export function extractJpegsFromPdf(pdf: Buffer): Buffer[] {
  const STREAM = Buffer.from('stream')
  const ENDSTREAM = Buffer.from('endstream')
  const END = Buffer.from('end')
  const SOI = Buffer.from([0xff, 0xd8, 0xff])
  const jpegs: Buffer[] = []
  let cursor = 0
  while (cursor < pdf.length) {
    const s = pdf.indexOf(STREAM, cursor)
    if (s === -1) break
    // "stream" tambien matchea dentro de "endstream" — saltear esos
    if (s >= 3 && pdf.subarray(s - 3, s).equals(END)) {
      cursor = s + STREAM.length
      continue
    }
    let start = s + STREAM.length
    if (pdf[start] === 0x0d) start++
    if (pdf[start] === 0x0a) start++
    const e = pdf.indexOf(ENDSTREAM, start)
    if (e === -1) break
    // el EOL previo a "endstream" no es parte del contenido
    let end = e
    if (end > start && pdf[end - 1] === 0x0a) end--
    if (end > start && pdf[end - 1] === 0x0d) end--
    if (end - start > 1024 && pdf.subarray(start, start + 3).equals(SOI)) {
      jpegs.push(pdf.subarray(start, end))
    }
    cursor = e + ENDSTREAM.length
  }
  return jpegs
}

// Devuelve la foto lista para mosaico, o null si este archivo no es candidato
// (PDF real multi-pagina, imagen chica, formato raro) — en ese caso el caller
// usa el camino de siempre (archivo unico a la API).
export async function unwrapPhoto(fileBytes: Buffer, mimeType: string): Promise<PreparedPhoto | null> {
  let photoBytes: Buffer
  if (mimeType === 'application/pdf') {
    const [biggest, second] = extractJpegsFromPdf(fileBytes).sort((a, b) => b.length - a.length)
    if (!biggest) return null
    // Si hay mas de una foto grande es un PDF escaneado multi-pagina: mejor
    // mandarlo entero como PDF que perder paginas desarmandolo.
    if (second && second.length > biggest.length * 0.5) return null
    photoBytes = biggest
  } else if (IMAGE_MIMES.has(mimeType)) {
    photoBytes = fileBytes
  } else {
    return null
  }

  const meta = await sharp(photoBytes).metadata()
  if (!meta.width || !meta.height) return null
  const exifSwapsAxes = (meta.orientation ?? 1) >= 5
  const width = exifSwapsAxes ? meta.height : meta.width
  const height = exifSwapsAxes ? meta.width : meta.height
  if (width * height < MIN_PIXELS_FOR_TILING) return null

  // Horneamos la orientacion EXIF una sola vez asi los pipelines posteriores
  // (overview, tiles) pueden rotar/recortar sin pelearse con el EXIF.
  const bytes =
    (meta.orientation ?? 1) === 1
      ? photoBytes
      : await sharp(photoBytes).rotate().jpeg({ quality: 92 }).toBuffer()

  return { bytes, width, height }
}

// Vista completa del comprobante al tamano que la API muestra igual (≤1568).
// Sirve para que el modelo entienda la estructura global y tambien para la
// mini-llamada de deteccion de rotacion.
export async function renderOverview(photo: PreparedPhoto, deg: RotationDeg): Promise<Buffer> {
  let pipe = sharp(photo.bytes)
  if (deg !== 0) pipe = pipe.rotate(deg)
  return pipe
    .resize({ width: API_LONG_EDGE, height: API_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer()
}

// Mosaico de recortes con solapamiento sobre la foto ampliada. Devuelve los
// tiles en orden de lectura (izquierda→derecha, arriba→abajo).
export async function renderTiles(photo: PreparedPhoto, deg: RotationDeg): Promise<Buffer[]> {
  const swap = deg % 180 !== 0
  const rw = swap ? photo.height : photo.width
  const rh = swap ? photo.width : photo.height
  const scale = Math.min(1, TARGET_LONG_EDGE / Math.max(rw, rh))
  const W = Math.round(rw * scale)
  const H = Math.round(rh * scale)

  let pipe = sharp(photo.bytes)
  if (deg !== 0) pipe = pipe.rotate(deg)
  const base = await pipe.resize({ width: W, height: H, fit: 'fill' }).jpeg({ quality: 90 }).toBuffer()

  const cols = Math.ceil(W / TILE_STEP)
  const rows = Math.ceil(H / TILE_STEP)
  if (cols * rows <= 1) {
    return [await sharp(base).jpeg({ quality: 80 }).toBuffer()]
  }

  const stepX = Math.ceil(W / cols)
  const stepY = Math.ceil(H / rows)
  const tiles: Buffer[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const left = Math.max(0, c * stepX - TILE_OVERLAP)
      const top = Math.max(0, r * stepY - TILE_OVERLAP)
      const right = Math.min(W, (c + 1) * stepX + TILE_OVERLAP)
      const bottom = Math.min(H, (r + 1) * stepY + TILE_OVERLAP)
      tiles.push(
        await sharp(base)
          .extract({ left, top, width: right - left, height: bottom - top })
          .jpeg({ quality: 80 })
          .toBuffer(),
      )
    }
  }
  return tiles
}
