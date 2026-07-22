import { z } from 'zod'
import { ingredienteFormSchema, UNITS } from '../recetas/schemas'

export { ingredienteFormSchema }

export const descartableItemSchema = z.object({
  insumo_id: z.string().uuid(),
  qty: z.number().positive('La cantidad debe ser mayor a 0'),
})

// El schema "clasico" (single-variant) se mantiene por compatibilidad con
// updateProductoPrecio y otras rutas que no manejan variantes. La UI usa
// productoConVariantesSchema (abajo) que agrupa base + delivery + menu en
// una unica transaccion.
export const productoSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  sale_price: z.number().min(0, 'El precio debe ser 0 o mayor'),
  target_margin_pct: z.number().min(0).max(100).default(30),
  is_dynamic: z.boolean().default(false),
  receta_id: z.string().uuid().nullable().optional(),
  yield_qty: z.number().positive('El rendimiento debe ser mayor a 0').default(1),
  yield_unit: z.enum(UNITS).default('u'),
  ingredientes: z.array(ingredienteFormSchema).default([]),
  descartables: z.array(descartableItemSchema).default([]),
  concepto_name: z.string().nullable().default(null),
  canal: z.enum(['salon', 'delivery']).nullable().default(null),
  formato: z.enum(['individual', 'menu']).nullable().default(null),
})

export type ProductoFormValues = z.infer<typeof productoSchema>

// Datos de una variante individual: precio, receta y su lista de ingredientes
// + descartables. Todas las variantes de un mismo concepto comparten name,
// margen, rendimiento y is_dynamic; difieren en precio + ingredientes + insumos
// (que es lo que cambia la UX/costo entre delivery y salon).
export const variantDataSchema = z.object({
  // producto_id null = todavia no existe (se crea al guardar)
  producto_id: z.string().uuid().nullable().default(null),
  receta_id: z.string().uuid().nullable().default(null),
  sale_price: z.number().min(0, 'El precio debe ser 0 o mayor'),
  ingredientes: z.array(ingredienteFormSchema).default([]),
  descartables: z.array(descartableItemSchema).default([]),
})
export type VariantData = z.infer<typeof variantDataSchema>

export const productoConVariantesSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  target_margin_pct: z.number().min(0).max(100).default(30),
  is_dynamic: z.boolean().default(false),
  yield_qty: z.number().positive('El rendimiento debe ser mayor a 0').default(1),
  yield_unit: z.enum(UNITS).default('u'),
  // Producto que se compra ya hecho (gaseosa, agua, medialuna): su receta es
  // 1 insumo 1:1 que se descuenta del stock por venta. Ver migracion 0056.
  es_reventa: z.boolean().default(false),
  // Base siempre existe. delivery y menu son opcionales (null = no hay variante).
  base: variantDataSchema,
  delivery: variantDataSchema.nullable().default(null),
  menu: variantDataSchema.nullable().default(null),
})
export type ProductoConVariantesFormValues = z.infer<typeof productoConVariantesSchema>

// Discriminador de variante en la UI.
export const VARIANT_KEYS = ['base', 'delivery', 'menu'] as const
export type VariantKey = (typeof VARIANT_KEYS)[number]
// La variante `delivery` se muestra como "Barra" en la UI. El key interno,
// el enum `canal='delivery'` en productos y el sufijo del name en la BD siguen
// siendo 'delivery' — es solo un cambio de label visible.
export const VARIANT_LABELS: Record<VariantKey, string> = {
  base: 'Base',
  delivery: 'Barra',
  menu: 'Menú',
}
// Nombre del producto en la BD segun la variante. La tabla productos tiene
// unique(tenant_id, name), asi que cada variante necesita un nombre distinto.
// Convencion:
//   base     -> baseName
//   delivery -> baseName + " Delivery"  (matchea data historica tipo "Empanada Delivery")
//   menu     -> "Menú " + baseName      (matchea data historica de menu)
export function variantProductoName(baseName: string, key: VariantKey): string {
  if (key === 'menu') return `Menú ${baseName}`
  if (key === 'delivery') return `${baseName} Delivery`
  return baseName
}

// Schema del form del ProductoDialog: solo los campos que se editan por variante
// (sale_price, ingredientes, descartables, receta_id) + los shared (name, margen,
// rendimiento, is_dynamic). Los otros datos por-variante viven en state React.
export const productoDialogFormSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  sale_price: z.number().min(0, 'El precio debe ser 0 o mayor'),
  target_margin_pct: z.number().min(0).max(100).default(30),
  is_dynamic: z.boolean().default(false),
  receta_id: z.string().uuid().nullable().optional(),
  yield_qty: z.number().positive('El rendimiento debe ser mayor a 0').default(1),
  yield_unit: z.enum(UNITS).default('u'),
  es_reventa: z.boolean().default(false),
  ingredientes: z.array(ingredienteFormSchema).default([]),
  descartables: z.array(descartableItemSchema).default([]),
})
export type ProductoDialogFormValues = z.infer<typeof productoDialogFormSchema>
