import { z } from 'zod'

// Schema que la IA debe devolver al parsear un comprobante (factura, ticket,
// remito). Sirve también como output_config del SDK Anthropic — el modelo está
// forzado a respetarlo, así que evitamos el rabbit hole de validar JSON crudo.
export const comprobanteItemSchema = z.object({
  nombre: z.string().min(1, 'El nombre del item es requerido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  unidad: z.string().nullable(),
  precio_unitario: z.number().min(0).nullable(),
  precio_total: z.number().min(0),
})
export type ComprobanteItem = z.infer<typeof comprobanteItemSchema>

export const comprobanteExtractSchema = z.object({
  fecha: z.string().nullable().describe('Fecha del comprobante en formato ISO YYYY-MM-DD si está visible, sino null'),
  total_general: z.number().min(0).nullable().describe('Total general del comprobante si está visible'),
  items: z.array(comprobanteItemSchema).describe('Líneas de detalle: cada producto con cantidad, unidad, precio'),
  observaciones: z.string().nullable().describe('Notas o información adicional relevante del comprobante'),
})
export type ComprobanteExtract = z.infer<typeof comprobanteExtractSchema>

// Sugerencia de match contra el catálogo de insumos del tenant. score 0..1.
export type InsumoMatch = {
  insumo_id: string
  name: string
  unit: string
  score: number
}

export type ItemConMatch = {
  // Lo que devolvió la IA
  detected: ComprobanteItem
  // Top 3 sugerencias por similitud
  candidates: InsumoMatch[]
  // Sugerencia primaria pre-seleccionada (o null si no hay match confiable)
  suggested_insumo_id: string | null
  // 'alias': vino de insumo_aliases (match aprendido antes para este proveedor)
  // 'fuzzy': vino de pg_trgm sobre el catalogo
  // null: sin sugerencia confiable
  match_source: 'alias' | 'fuzzy' | null
}
