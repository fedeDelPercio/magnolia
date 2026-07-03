import { z } from 'zod'
import { ingredienteFormSchema, UNITS } from '../recetas/schemas'

export { ingredienteFormSchema }

export const descartableItemSchema = z.object({
  insumo_id: z.string().uuid(),
  qty: z.number().positive('La cantidad debe ser mayor a 0'),
})

export const productoSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  sale_price: z.number().min(0, 'El precio debe ser 0 o mayor'),
  target_margin_pct: z.number().min(0).max(100).default(30),
  is_dynamic: z.boolean().default(false),
  // Receta inline — siempre existe, 1:1 con el producto
  receta_id: z.string().uuid().nullable().optional(), // id de la receta existente (interno)
  yield_qty: z.number().positive('El rendimiento debe ser mayor a 0').default(1),
  yield_unit: z.enum(UNITS).default('u'),
  ingredientes: z.array(ingredienteFormSchema).default([]),
  descartables: z.array(descartableItemSchema).default([]),
  // Variantes. concepto_name se resuelve a concepto_id via get-or-create al
  // guardar; asi Caro puede tipear el nombre del concepto sin manejar UUIDs.
  // canal/formato son los ejes de la variante: si dos productos comparten
  // concepto, deben diferir al menos en uno de estos ejes (unique index).
  concepto_name: z.string().nullable().default(null),
  canal: z.enum(['salon', 'delivery']).nullable().default(null),
  formato: z.enum(['individual', 'menu']).nullable().default(null),
})

export type ProductoFormValues = z.infer<typeof productoSchema>
