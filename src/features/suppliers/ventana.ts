// Ventana de tiempo de cada gráfico del detalle de proveedor: cuánto hacia
// atrás desde hoy se mira (1 mes, 90 días, 1 año o todo). Es propia de cada
// gráfico e independiente del rango de fechas de la página (que filtra la
// lista de compras).

export type Ventana = '30' | '90' | '365' | 'todo'

export const VENTANA_LABELS: Record<Ventana, string> = {
  '30': '1 mes',
  '90': '90 días',
  '365': '1 año',
  todo: 'Todo',
}

export const VENTANA_DEFAULT: Ventana = '90'

// Nombre del lapso para títulos ("Últimos 90 días") y frases ("en los últimos 90 días").
export const VENTANA_NOMBRE: Record<Ventana, string> = {
  '30': 'Último mes',
  '90': 'Últimos 90 días',
  '365': 'Último año',
  todo: 'Todo el historial',
}

export function enLaVentana(v: Ventana): string {
  return v === 'todo' ? 'todo el historial' : `${v === '90' ? 'los' : 'el'} ${VENTANA_NOMBRE[v].toLowerCase()}`
}

// YYYY-MM-DD menos n días (aritmética en UTC: sin saltos por horario de verano).
export function restarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1))
  t.setUTCDate(t.getUTCDate() - dias)
  return t.toISOString().slice(0, 10)
}

// Lo que cae en la ventana: desde hoy − N días (inclusive). Sin tope arriba,
// para no esconder compras con fecha cargada a futuro.
export function enVentana<T extends { fecha: string }>(items: T[], ventana: Ventana, hoy: string): T[] {
  if (ventana === 'todo') return items
  const desde = restarDias(hoy, Number(ventana))
  return items.filter((i) => i.fecha.slice(0, 10) >= desde)
}
