import { z } from 'zod'

import { extractStructuredFromFile, extractStructuredFromFiles } from '@/lib/llm/vision'
import { unwrapPhoto, renderOverview, renderTiles, type RotationDeg } from '@/lib/llm/image-prep'

import { comprobanteExtractSchema, type ComprobanteExtract } from './schemas'

const SYSTEM_PROMPT = `Sos un asistente experto en interpretar comprobantes de compra (facturas, tickets, remitos) de proveedores gastronómicos argentinos. Tu única tarea es extraer los datos del comprobante a un JSON estructurado.

Reglas clave:
- Fecha: si aparece "DD/MM/YYYY" o "DD-MM-AAAA", convertí a ISO YYYY-MM-DD. Si no hay fecha visible, devolvé null.
- Montos: el formato argentino usa punto como separador de miles y coma como decimal ("$ 1.250,50" = 1250.50). Devolvé números puros sin signo $.
- Items: cada línea de producto/insumo con su cantidad, unidad de medida y precio. Si la unidad no es explícita (ej. solo dice "10 huevos"), inferí unidad razonable ("u"); si dice "5 kg de azúcar" → unidad="kg".
- nombre: el texto del producto TAL CUAL figura en el comprobante, sin agregarle nada (nada de sufijos tipo "(código 123)" ni el SKU) — se usa para matchear contra compras anteriores y tiene que ser estable entre facturas.
- Si la línea tiene cantidad y precio total pero NO precio unitario explícito, calculá precio_unitario = precio_total / cantidad y devolvelo.
- Ignorá líneas que sean subtotales, IVA, descuentos generales, o totales — solo querés productos/insumos comprados.
- Si un campo no aparece, usá null (texto) o no lo incluyas (números opcionales).
- Si la imagen es ilegible o no es un comprobante, devolvé items vacío y aclará en observaciones.`

const USER_PROMPT = `Extraé los datos de este comprobante siguiendo el esquema. Sé fiel a los números — no infieras ni completes campos faltantes.`

// Cuando mandamos mosaico (overview + recortes ampliados) el modelo necesita
// saber que todo es UN solo comprobante y que los numeros se leen de los
// recortes, no de la vista completa reducida.
const TILED_USER_PROMPT = `${USER_PROMPT}

Recibís varias imágenes de UN MISMO comprobante: primero la vista completa y después recortes ampliados en orden de lectura (izquierda a derecha, arriba a abajo), con solapamiento entre recortes vecinos. Usá la vista completa para entender la estructura y leé cantidades y montos desde los recortes ampliados, que son la fuente confiable. Cada línea del comprobante es UN solo item — no dupliques las que aparecen en más de un recorte.`

export type VisionResult = {
  extract?: ComprobanteExtract
  rawResponse?: unknown
  error?: string
}

// Mini-llamada para saber cuántos grados hay que rotar la foto para que el
// texto quede derecho (fotos sacadas con el teléfono de costado). Se hace
// sobre la vista reducida — barata (~1.5k tokens de input).
const rotationSchema = z.object({
  rotacion: z
    .enum(['0', '90', '180', '270'])
    .describe('Grados en sentido horario que hay que rotar la imagen para que el texto quede derecho y legible'),
})

async function detectTextRotation(overview: Buffer): Promise<RotationDeg> {
  const res = await extractStructuredFromFile({
    fileBytes: overview,
    mimeType: 'image/jpeg',
    systemPrompt:
      'Mirás la foto de un documento y decís cuántos grados en sentido horario hay que rotarla para que el texto quede derecho (orientación normal de lectura).',
    userPrompt: '¿Cuántos grados en sentido horario hay que rotar esta imagen para que el texto quede derecho?',
    schema: rotationSchema,
    modelTier: 'sonnet',
    maxTokens: 300,
    schemaName: 'rotacion_documento',
  })
  const deg = res.data ? Number(res.data.rotacion) : 0
  return deg === 90 || deg === 180 || deg === 270 ? deg : 0
}

// Si el archivo es una foto grande (directa, o envuelta en un PDF wrapper),
// arma [vista completa, ...recortes ampliados] ya rotados para que el texto
// quede derecho. Devuelve null si el archivo no es candidato o si cualquier
// paso falla — el caller cae al camino de siempre (archivo único a la API).
async function prepareTiledImages(fileBytes: Buffer, mimeType: string): Promise<Buffer[] | null> {
  try {
    const photo = await unwrapPhoto(fileBytes, mimeType)
    if (!photo) return null

    const overview0 = await renderOverview(photo, 0)
    let deg: RotationDeg = 0
    try {
      deg = await detectTextRotation(overview0)
    } catch {
      // sin deteccion de rotacion seguimos igual: tiles a 0 grados
    }

    const tiles = await renderTiles(photo, deg)
    // Un solo tile sin rotar = lo mismo que mandar la imagen original
    if (tiles.length <= 1 && deg === 0) return null

    const overview = deg === 0 ? overview0 : await renderOverview(photo, deg)
    return [overview, ...tiles]
  } catch {
    return null
  }
}

// Llama al LLM (Anthropic o OpenRouter segun LLM_PROVIDER) con la imagen/PDF
// + prompt y devuelve un ComprobanteExtract validado por Zod. La abstraccion
// vive en @/lib/llm/vision — ver ese archivo para docs de config.
//
// Para fotos grandes (el caso tipico: foto de telefono, a veces envuelta en
// PDF) primero armamos un mosaico de recortes en alta resolucion — la API
// reescala todo a ~1568px y una factura entera a ese tamano pierde los
// digitos. Ver @/lib/llm/image-prep para detalles. Si el preprocesado no
// aplica o falla, va el archivo original como siempre.
export async function extractComprobante(
  fileBytes: Buffer,
  mimeType: string,
): Promise<VisionResult> {
  const tiled = await prepareTiledImages(fileBytes, mimeType)
  if (tiled) {
    const result = await extractStructuredFromFiles({
      files: tiled.map((bytes) => ({ bytes, mimeType: 'image/jpeg' })),
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: TILED_USER_PROMPT,
      schema: comprobanteExtractSchema,
      modelTier: 'sonnet',
      maxTokens: 8000,
      schemaName: 'comprobante_extract',
    })
    if (result.data) {
      return { extract: result.data, rawResponse: result.rawResponse }
    }
    // si el path de mosaico fallo, reintentamos con el archivo original
  }

  const result = await extractStructuredFromFile({
    fileBytes,
    mimeType,
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: USER_PROMPT,
    schema: comprobanteExtractSchema,
    modelTier: 'sonnet',
    maxTokens: 8000,
    schemaName: 'comprobante_extract',
  })
  return { extract: result.data, rawResponse: result.rawResponse, error: result.error }
}

// Legacy: se leia como campo informativo del uploaded record. El modelo real
// ahora se decide en @/lib/llm/vision segun el proveedor activo — dejamos un
// placeholder para que el schema del upload no rompa.
export const COMPROBANTE_MODEL = 'sonnet'
