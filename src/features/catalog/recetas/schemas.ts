import { z } from 'zod'
import { UNITS, UNIT_LABELS, type UnitKind } from '../insumos/schemas'

export { UNITS, UNIT_LABELS, type UnitKind }

export const ingredienteFormSchema = z
  .object({
    kind: z.enum(['insumo', 'receta'] as const),
    insumo_id: z.string().uuid().nullable().optional(),
    sub_receta_id: z.string().uuid().nullable().optional(),
    qty: z.number().positive('La cantidad debe ser mayor a 0'),
    unit: z.enum(UNITS),
  })
  .refine(
    (data) =>
      (data.kind === 'insumo' && !!data.insumo_id) ||
      (data.kind === 'receta' && !!data.sub_receta_id),
    { message: 'Seleccioná el ingrediente' },
  )

export const recetaSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  category: z.string().optional(),
  yield_qty: z.number().positive('El rendimiento debe ser mayor a 0'),
  yield_unit: z.enum(UNITS),
  notes: z.string().optional(),
  ingredientes: z.array(ingredienteFormSchema).default([]),
})

export type IngredienteFormValues = z.infer<typeof ingredienteFormSchema>
export type RecetaFormValues = z.infer<typeof recetaSchema>
