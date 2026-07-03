// Etiquetas DOW: 0=domingo, 1=lunes, ..., 6=sabado. Orden que devuelve
// getDay() del Date de JS — no requiere conversiones al usar en el sync.
//
// Vive en su propio file (fuera de queries.ts) para que los componentes
// 'use client' puedan importarlo sin arrastrar el server client de Supabase
// al bundle del cliente.
export const DOW_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const

export type RecetaDelDiaAsignacion = {
  dow: number
  producto_id: string
  producto_name: string
  concepto_id: string | null
  concepto_name: string | null
}
