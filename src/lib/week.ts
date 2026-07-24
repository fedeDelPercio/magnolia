// Utilidades de semana calendario. La semana arranca el LUNES (como el resto
// de la app: dashboard, calendario de operación). Todo en hora local del server
// (en Vercel es UTC). Sin dependencias de librerías de fecha.

export function toYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Lunes de la semana de `d`, como 'YYYY-MM-DD'.
export function mondayOf(d: Date): string {
  const day = d.getDay() // 0=domingo, 1=lunes, ...
  const diff = day === 0 ? 6 : day - 1 // domingo cuenta como fin de la semana previa
  return toYMD(new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff))
}

// Lunes de la semana de una fecha 'YYYY-MM-DD'.
export function mondayOfYMD(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  return mondayOf(new Date(y!, m! - 1, d!))
}

// Suma n semanas a un week_start 'YYYY-MM-DD' (n puede ser negativo).
export function addWeeks(weekStart: string, n: number): string {
  const [y, m, d] = weekStart.split('-').map(Number)
  return toYMD(new Date(y!, m! - 1, d! + n * 7))
}
