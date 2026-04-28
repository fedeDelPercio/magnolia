import { z } from 'zod'

export const proveedorSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().optional(),
  payment_terms_days: z.number().int().min(0).default(0),
  notes: z.string().optional(),
})
export type ProveedorFormValues = z.infer<typeof proveedorSchema>

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
