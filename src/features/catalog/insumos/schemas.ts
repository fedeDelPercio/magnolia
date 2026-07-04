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

export const INSUMO_KINDS = ['ingrediente', 'descartable'] as const
export type InsumoKind = (typeof INSUMO_KINDS)[number]
export const INSUMO_KIND_LABELS: Record<InsumoKind, string> = {
  ingrediente: 'Ingrediente',
  descartable: 'Descartable',
}

export const insumoSchema = z
  .object({
    name: z.string().min(1, 'El nombre es requerido'),
    kind: z.enum(INSUMO_KINDS).default('ingrediente'),
    unit: z.enum(UNITS),
    current_price: z.number().min(0, 'El precio debe ser 0 o mayor'),
    proveedor_id: z.string().uuid().nullable().optional(),
    perishable: z.boolean().default(false),
    shelf_life_days: z.number().int().positive().nullable().optional(),
    track_stock: z.boolean().default(true),
    stock_inicial: z.number().min(0).default(0),
    // Presentación de compra opcional. Si se setea uno, hay que setear el otro.
    // Ej: comprás "cajón" y 1 cajón = 10 kg → label="cajón", factor=10.
    purchase_unit_label: z.string().trim().min(1).nullable().optional(),
    purchase_unit_factor: z.number().positive().nullable().optional(),
  })
  .refine(
    (data) => !data.perishable || (data.shelf_life_days != null && data.shelf_life_days > 0),
    { message: 'Indicá la vida útil en días para insumos perecederos', path: ['shelf_life_days'] },
  )
  .refine(
    (data) => {
      const hasLabel = !!data.purchase_unit_label
      const hasFactor = data.purchase_unit_factor != null
      return hasLabel === hasFactor
    },
    {
      message: 'Completá el nombre de la presentación y la equivalencia (o dejá ambos vacíos)',
      path: ['purchase_unit_factor'],
    },
  )

export type InsumoFormValues = z.infer<typeof insumoSchema>

export const stockAjusteSchema = z.object({
  stock_real: z
    .number({ error: 'Ingresá el stock real' })
    .min(0, 'El stock no puede ser negativo'),
  notas: z.string().max(500).optional(),
})

export type StockAjusteValues = z.infer<typeof stockAjusteSchema>
