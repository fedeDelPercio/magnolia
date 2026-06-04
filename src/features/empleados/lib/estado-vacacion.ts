export type EstadoVacacion = 'planificadas' | 'en_curso' | 'completas' | 'canceladas'

export const ESTADO_LABELS: Record<EstadoVacacion, string> = {
  planificadas: 'Planificadas',
  en_curso: 'En curso',
  completas: 'Completas',
  canceladas: 'Canceladas',
}

export const ESTADO_TONE: Record<EstadoVacacion, string> = {
  planificadas: 'border-sky-200 bg-sky-50 text-sky-700',
  en_curso: 'border-amber-200 bg-amber-50 text-amber-700',
  completas: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  canceladas: 'border-rose-200 bg-rose-50 text-rose-700 line-through',
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Estado derivado por fecha + flag de cancelación.
 *  - canceladas: si `cancelada=true` (sin importar fecha).
 *  - planificadas: hoy < fecha_desde.
 *  - en_curso: fecha_desde <= hoy <= fecha_hasta.
 *  - completas: hoy > fecha_hasta.
 */
export function estadoVacacion(
  v: { fecha_desde: string; fecha_hasta: string; cancelada: boolean },
  today: string = todayISO(),
): EstadoVacacion {
  if (v.cancelada) return 'canceladas'
  if (today < v.fecha_desde) return 'planificadas'
  if (today > v.fecha_hasta) return 'completas'
  return 'en_curso'
}
