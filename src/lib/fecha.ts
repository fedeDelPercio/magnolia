// Fecha de hoy (YYYY-MM-DD) en hora de Argentina, igual en el navegador y en
// el servidor. `new Date().toISOString().slice(0, 10)` da la fecha UTC: después
// de las 21 h cargaba pagos y compras con la fecha de mañana.
export function hoyISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}
