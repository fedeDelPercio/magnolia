import { extractStructuredFromFile } from '@/lib/llm/vision'

import { comprobanteExtractSchema, type ComprobanteExtract } from './schemas'

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

// Llama al LLM (Anthropic o OpenRouter segun LLM_PROVIDER) con la imagen/PDF
// + prompt y devuelve un ComprobanteExtract validado por Zod. La abstraccion
// vive en @/lib/llm/vision — ver ese archivo para docs de config.
export async function extractComprobante(
  fileBytes: Buffer,
  mimeType: string,
): Promise<VisionResult> {
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
