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

// Valores permitidos para IVA (proveedor / compra / item). Mismos que el CHECK
// constraint en BD. 0 = sin IVA, 10.5 = alicuota reducida (algunos productos),
// 21 = alicuota general.
export const IVA_RATES = [0, 10.5, 21] as const
export type IvaRate = (typeof IVA_RATES)[number]
export const IVA_RATE_LABELS: Record<number, string> = {
  0: 'Sin IVA',
  10.5: '10,5%',
  21: '21%',
}

// Tipo de proveedor. 'insumo' es el default historico (mercaderia / ingredientes)
// y 'servicio' es el nuevo (internet, luz, gas, etc. con conceptos y pagos
// puntuales que trackean incremento de precios).
export const PROVEEDOR_TIPOS = ['insumo', 'servicio'] as const
export type ProveedorTipo = (typeof PROVEEDOR_TIPOS)[number]
export const PROVEEDOR_TIPO_LABELS: Record<ProveedorTipo, string> = {
  insumo: 'Insumos',
  servicio: 'Servicios',
}

export const proveedorSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  tipo: z.enum(PROVEEDOR_TIPOS).default('insumo'),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().optional(),
  notes: z.string().optional(),
  // IVA que aplica a las compras de este proveedor por defecto. Cada compra
  // puede overridearlo. Reemplaza al flag booleano discrimina_iva (que se
  // mantiene por back-compat sincronizado con iva_rate>0).
  iva_rate: z
    .number()
    .refine((v): v is IvaRate => (IVA_RATES as readonly number[]).includes(v), 'IVA inválido')
    .default(0),
  // % de descuento habitual del proveedor (default para nuevas compras).
  descuento_pct: z.number().min(0).max(100).default(0),
  payment_rule: paymentRuleSchema.nullable().optional(),
})
export type ProveedorFormValues = z.infer<typeof proveedorSchema>

// Concepto de servicio (ej: "Internet 500MB", "Luz Bimestral"). Es un item
// dentro del proveedor de servicios, sobre el que se registran pagos.
export const conceptoServicioSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(80),
})
export type ConceptoServicioFormValues = z.infer<typeof conceptoServicioSchema>

// Pago de servicio. Concepto opcional (permite pagos sueltos si aun no se
// dieron de alta los conceptos). El monto es el precio en esa fecha, se usa
// para graficar el incremento en el tiempo.
export const pagoServicioSchema = z.object({
  fecha: z.string().min(1, 'Fecha requerida'),
  monto: z.number().positive('El monto tiene que ser mayor a 0'),
  concepto_id: z.string().uuid().nullable().optional(),
  notas: z.string().optional(),
  // Si true, adicionalmente al pago crea un egreso en caja movimientos
  // categoria "Pago a proveedores" para que aparezca en el flujo.
  generar_egreso_caja: z.boolean().default(true),
})
export type PagoServicioFormValues = z.infer<typeof pagoServicioSchema>

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
  // Si true Y el insumo no tenia track_stock activo, lo activa al crear la
  // compra y setea stock_inicial = qty.
  start_tracking: z.boolean().optional(),
  // Si true Y el insumo tiene track_stock activo, lo desactiva al guardar
  // (no toca stock_inicial ni stock_actual — solo apaga el control). Sirve
  // para que la user pueda apagar tracking desde el dialog de compra sin
  // ir al catalogo de insumos.
  stop_tracking: z.boolean().optional(),
  // Override de IVA por linea. Si null / undefined, se usa el iva_rate global
  // de la compra (que a su vez viene del proveedor por default).
  iva_rate: z
    .number()
    .refine((v): v is IvaRate => (IVA_RATES as readonly number[]).includes(v), 'IVA inválido')
    .nullable()
    .optional(),
})
export type CompraItemFormValues = z.infer<typeof compraItemSchema>

export const pagoSchema = z
  .object({
    fecha: z.string().min(1),
    monto: z.number().positive('Monto requerido'),
    metodo: z.enum(['efectivo', 'transferencia', 'cheque', 'otro']),
    descripcion: z.string().optional(),
    // Sólo aplica cuando metodo === 'cheque'. Se computa desde el plazo seleccionado.
    due_date: z.string().optional(),
  })
  .refine((v) => v.metodo !== 'cheque' || !!v.due_date, {
    path: ['due_date'],
    message: 'Indicá la fecha de vencimiento del cheque',
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
