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

// Una semana del menú. `offset` es relativo a la semana en curso:
// -2 y -1 = las dos semanas pasadas (solo lectura), 0 = semana actual,
// 1 = próxima semana. Solo la actual y la próxima son editables.
export type RecetaSemana = {
  week_start: string   // lunes de la semana, 'YYYY-MM-DD'
  offset: number       // -2 | -1 | 0 | 1
  editable: boolean
  dias: Array<{ dow: number; asignacion: RecetaDelDiaAsignacion | null }>
}

// Los 4 offsets que se muestran, de más viejo a más nuevo.
export const SEMANA_OFFSETS = [-2, -1, 0, 1] as const

export function semanaLabel(offset: number): string {
  switch (offset) {
    case -2: return 'Hace 2 semanas'
    case -1: return 'Semana pasada'
    case 0: return 'Esta semana'
    case 1: return 'Próxima semana'
    default: return ''
  }
}
