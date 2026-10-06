import { z } from 'zod'

export const empleadoSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  fecha_ingreso: z.string().optional(),
  sueldo_diario: z.number().nonnegative('No puede ser negativo'),
  plus_mensual: z.number().nonnegative('No puede ser negativo'),
  aguinaldo_estimado: z.number().nonnegative('No puede ser negativo'),
  vacaciones_dias_anuales: z.number().int().min(0).max(60),
  activo: z.boolean().default(true),
  notas: z.string().optional(),
})
export type EmpleadoFormValues = z.infer<typeof empleadoSchema>

export const horarioSchema = z.object({
  dow: z.number().int().min(0).max(6),
  hora_inicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  hora_fin: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
})
export type HorarioFormValues = z.infer<typeof horarioSchema>

export const vacacionSchema = z
  .object({
    fecha_desde: z.string().min(1, 'Requerido'),
    fecha_hasta: z.string().min(1, 'Requerido'),
    notas: z.string().optional(),
  })
  .refine((v) => v.fecha_hasta >= v.fecha_desde, {
    path: ['fecha_hasta'],
    message: 'Hasta no puede ser anterior a desde',
  })
export type VacacionFormValues = z.infer<typeof vacacionSchema>

export const TIPO_AUSENCIA = ['justificada', 'injustificada', 'enfermedad', 'feriado', 'licencia'] as const
export type TipoAusencia = (typeof TIPO_AUSENCIA)[number]

export const ausenciaSchema = z.object({
  fecha: z.string().min(1),
  tipo: z.enum(TIPO_AUSENCIA),
  paga: z.boolean().default(false),
  notas: z.string().optional(),
})
export type AusenciaFormValues = z.infer<typeof ausenciaSchema>

export const TIPO_AUSENCIA_LABELS: Record<TipoAusencia, string> = {
  justificada: 'Justificada',
  injustificada: 'Injustificada',
  enfermedad: 'Enfermedad',
  feriado: 'Feriado',
  licencia: 'Licencia',
}

// 0 = domingo, 1 = lunes, ... 6 = sábado. Coincide con Date#getDay().
export const DOW_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const
export const DOW_LABELS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] as const

// Descuento sobre el plus mensual (desperdicio u otro faltante del empleado).
// Producto + cantidad son opcionales: sirven para sugerir el monto con el costo
// del producto y dejar registro de qué fue.
export const descuentoSchema = z.object({
  fecha: z.string().min(1, 'Requerido'),
  motivo: z.string().trim().min(1, 'Contá qué pasó'),
  producto_id: z.string().uuid().nullable().optional(),
  cantidad: z.number().positive().nullable().optional(),
  monto: z.number().positive('El monto tiene que ser mayor a 0'),
})
export type DescuentoFormValues = z.infer<typeof descuentoSchema>

// Llegada tarde: minutos que el empleado queda debiendo hasta recuperarlos.
export const tardanzaSchema = z.object({
  fecha: z.string().min(1, 'Requerido'),
  minutos: z
    .number()
    .int('Tienen que ser minutos enteros')
    .positive('Tiene que ser mayor a 0')
    .max(720, 'Máximo 12 horas'),
  notas: z.string().optional(),
})
export type TardanzaFormValues = z.infer<typeof tardanzaSchema>
