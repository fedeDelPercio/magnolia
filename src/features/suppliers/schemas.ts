import { z } from 'zod'

export const paymentRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('boletas'),
    n: z.number().int().positive('Tiene que ser mayor a 0'),
  }),
  z.object({
    kind: z.literal('monto'),
    umbral: z.number().positive('Tiene que ser mayor a 0'),
  }),
  z.object({
    kind: z.literal('fecha_dia_mes'),
    dia_mes: z.number().int().min(1).max(31),
  }),
  z.object({
    kind: z.literal('fecha_nth_dow'),
    nth: z.number().int().min(1).max(5),
    dow: z.number().int().min(0).max(6),
  }),
])
export type PaymentRule = z.infer<typeof paymentRuleSchema>

export const proveedorSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().optional(),
  payment_terms_days: z.number().int().min(0).default(0),
  notes: z.string().optional(),
  discrimina_iva: z.boolean().default(false),
  payment_rule: paymentRuleSchema.nullable().optional(),
})
export type ProveedorFormValues = z.infer<typeof proveedorSchema>

export const DOW_LABELS: Record<number, string> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
}

export const NTH_LABELS: Record<number, string> = {
  1: '1er',
  2: '2do',
  3: '3er',
  4: '4to',
  5: '5to',
}

export const UNIDADES = ['kg', 'g', 'l', 'ml', 'u', 'docena', 'porcion'] as const

export const compraItemSchema = z.object({
  insumo_id: z.string().min(1, 'Seleccioná un insumo'),
  qty: z.number().positive('Cantidad requerida'),
  unit: z.enum(UNIDADES),
  unit_price: z.number().positive('Precio requerido'),
})
export type CompraItemFormValues = z.infer<typeof compraItemSchema>

export const pagoSchema = z.object({
  fecha: z.string().min(1),
  monto: z.number().positive('Monto requerido'),
  metodo: z.enum(['efectivo', 'transferencia', 'cheque', 'otro']),
  descripcion: z.string().optional(),
})
export type PagoFormValues = z.infer<typeof pagoSchema>

export const cajaEgresoSchema = z.object({
  fecha: z.string().min(1),
  categoria: z.string().min(1, 'Requerido'),
  monto: z.number().positive('Monto requerido'),
  descripcion: z.string().optional(),
})
export type CajaEgresoFormValues = z.infer<typeof cajaEgresoSchema>

export const METODO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cheque: 'Cheque',
  otro: 'Otro',
}
