import { z } from 'zod'

export const productoSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  sale_price: z.number().min(0, 'El precio debe ser 0 o mayor'),
  receta_id: z.string().uuid().nullable().optional(),
  descartable_cost: z.number().min(0).default(0),
  target_margin_pct: z.number().min(0).max(100).default(30),
  is_dynamic: z.boolean().default(false),
})

export type ProductoFormValues = z.infer<typeof productoSchema>
