import { z } from 'zod'

export const UNITS = ['kg', 'g', 'l', 'ml', 'u', 'docena', 'porcion'] as const
export type UnitKind = (typeof UNITS)[number]

export const UNIT_LABELS: Record<UnitKind, string> = {
  kg: 'kg',
  g: 'g',
  l: 'l',
  ml: 'ml',
  u: 'unidad',
  docena: 'docena',
  porcion: 'porción',
}

export const insumoSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    unit: z.enum(UNITS),
    current_price: z.number().min(0, 'El precio debe ser 0 o mayor'),
    proveedor_id: z.string().uuid().nullable().optional(),
    perishable: z.boolean().default(false),
    shelf_life_days: z.number().int().positive().nullable().optional(),
  })
  .refine(
    (data) => !data.perishable || (data.shelf_life_days != null && data.shelf_life_days > 0),
    { message: 'Indicá la vida útil en días para insumos perecederos', path: ['shelf_life_days'] },
  )

export type InsumoFormValues = z.infer<typeof insumoSchema>
