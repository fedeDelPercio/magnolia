import { z } from 'zod'

// Schema que Claude debe producir al extraer el PDF de Bistrosoft
export const cierreCajaExtractSchema = z.object({
  fecha_apertura: z
    .string()
    .describe(
      'Fecha y hora de apertura de caja en formato ISO 8601 (ej: "2026-04-30T07:38:06Z"). El PDF la muestra como DD/MM/YYYY HH:MM:SS.',
    ),
  fecha_cierre: z
    .string()
    .describe('Fecha y hora de cierre de caja en formato ISO 8601.'),
  operador: z.string().nullable().describe('Nombre del operador. Null si no aparece.'),
  razon_social: z.string().nullable().describe('Razón social del negocio. Null si no aparece.'),

  efectivo_apertura: z.number().describe('Efectivo en caja al abrir.'),
  efectivo_cierre: z.number().describe('Efectivo en caja al cerrar.'),

  total_vendido: z.number().describe('Total vendido del día (suma de todos los medios de pago).'),
  total_ventas: z.number().describe('Total de ventas según Bistrosoft.'),
  total_comandas: z.number().describe('Total de comandas según Bistrosoft.'),
  cantidad_comandas: z.number().int().describe('Cantidad de comandas emitidas.'),
  cantidad_ventas: z.number().int().describe('Cantidad de ventas emitidas.'),
  cubiertos: z.number().int().describe('Cantidad de cubiertos atendidos.'),
  ticket_promedio: z.number().describe('Ticket promedio por comensal.'),

  // Por medio de pago
  monto_efectivo: z.number().describe('Total cobrado en efectivo.'),
  monto_tarjetas: z.number().describe('Total cobrado con tarjetas.'),
  monto_qr: z.number().describe('Total cobrado con QR.'),
  monto_online: z.number().describe('Total cobrado online.'),
  monto_cuenta_cliente: z.number().describe('Total cargado a cuenta cliente.'),

  // Por origen
  monto_mostrador: z.number().describe('Total vendido por mostrador.'),
  monto_salon: z.number().describe('Total vendido por salón.'),

  // Otros movimientos
  total_retiros: z
    .number()
    .describe(
      'Total de retiros de caja (valor absoluto positivo; en el PDF aparece como negativo).',
    ),
  total_depositos: z.number().describe('Total de depósitos en caja.'),

  // Productos vendidos: viene agrupado por categoría con subtotales
  productos: z
    .array(
      z.object({
        categoria: z
          .string()
          .describe(
            'Categoría del PDF (ej: "SALON BEBIDA", "DELIVERY ALMUERZO", "SALON CAFETERIA"). Las líneas resaltadas en negrita son los encabezados de categoría.',
          ),
        nombre: z.string().describe('Nombre del producto tal como aparece en el PDF.'),
        cantidad: z.number().describe('Cantidad vendida.'),
        monto_total: z.number().describe('Monto total de ese producto.'),
      }),
    )
    .describe(
      'Lista de productos vendidos. Excluí las filas que son SOLO encabezados de categoría sin producto específico (no son productos). NO incluyas la fila "DESCUENTOS" si aparece — es un ajuste, no un producto.',
    ),
})

export type CierreCajaExtract = z.infer<typeof cierreCajaExtractSchema>

// Tipos para matching de productos Bistrosoft → Magnolia
export type MatchType = 'alias' | 'name_exact' | 'name_normalized' | null

export type ProductoMatch = {
  nombre: string // nombre Bistrosoft
  producto_id: string | null
  match_type: MatchType
}

// Lo que el frontend envía al guardar: por cada producto extraído,
// indicamos si quedó mapeado y si hay que persistir el alias
export type SaveMapping = {
  nombre: string
  producto_id: string | null
  save_as_alias: boolean // true si el match es manual y queremos recordarlo para próximos cierres
}

