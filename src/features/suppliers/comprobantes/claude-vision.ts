import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

import { comprobanteExtractSchema, type ComprobanteExtract } from './schemas'

const MODEL = 'claude-sonnet-4-6'

const SYSTEM_PROMPT = `Sos un asistente experto en interpretar comprobantes de compra (facturas, tickets, remitos) de proveedores gastronómicos argentinos. Tu única tarea es extraer los datos del comprobante a un JSON estructurado.

Reglas clave:
- Fecha: si aparece "DD/MM/YYYY" o "DD-MM-AAAA", convertí a ISO YYYY-MM-DD. Si no hay fecha visible, devolvé null.
- Montos: el formato argentino usa punto como separador de miles y coma como decimal ("$ 1.250,50" = 1250.50). Devolvé números puros sin signo $.
- Items: cada línea de producto/insumo con su cantidad, unidad de medida y precio. Si la unidad no es explícita (ej. solo dice "10 huevos"), inferí unidad razonable ("u"); si dice "5 kg de azúcar" → unidad="kg".
- Si la línea tiene cantidad y precio total pero NO precio unitario explícito, calculá precio_unitario = precio_total / cantidad y devolvelo.
- Ignorá líneas que sean subtotales, IVA, descuentos generales, o totales — solo querés productos/insumos comprados.
- Si un campo no aparece, usá null (texto) o no lo incluyas (números opcionales).
- Si la imagen es ilegible o no es un comprobante, devolvé items vacío y aclará en observaciones.`

const USER_PROMPT = `Extraé los datos de este comprobante siguiendo el esquema. Sé fiel a los números — no infieras ni completes campos faltantes.`

export type VisionResult = {
  extract?: ComprobanteExtract
  rawResponse?: unknown
  error?: string
}

// Llama a Claude Vision con la imagen + prompt y devuelve un ComprobanteExtract
// validado por Zod. El SDK garantiza output que respeta el schema (tool use
// forzado), pero igual hay que manejar errores de API, timeouts, etc.
export async function extractComprobante(
  fileBytes: Buffer,
  mimeType: string,
): Promise<VisionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { error: 'ANTHROPIC_API_KEY no configurada' }

  // Validar mime type compatible con Anthropic Vision (PDFs van como 'document', imágenes como 'image')
  const isPdf = mimeType === 'application/pdf'
  const isImage = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(mimeType)
  if (!isPdf && !isImage) return { error: `Tipo de archivo no soportado: ${mimeType}` }

  // Anthropic Vision no soporta HEIC/HEIF directo — Storage debería haberlo
  // convertido. Por las dudas, error temprano explícito.
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    return { error: 'HEIC/HEIF no es soportado por el modelo. Convertí a JPG o PNG.' }
  }

  try {
    const base64 = fileBytes.toString('base64')
    const client = new Anthropic({ apiKey })

    const content = isPdf
      ? [
          { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64 } },
          { type: 'text' as const, text: USER_PROMPT },
        ]
      : [
          {
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 },
          },
          { type: 'text' as const, text: USER_PROMPT },
        ]

    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
      output_config: { format: zodOutputFormat(comprobanteExtractSchema) },
    })

    if (!response.parsed_output) return { error: 'La IA no pudo extraer datos del comprobante', rawResponse: response }
    return { extract: response.parsed_output, rawResponse: response }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Error desconocido al llamar a la IA' }
  }
}

export const COMPROBANTE_MODEL = MODEL
