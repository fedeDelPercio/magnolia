// Categoría especial de egreso que DERIVA plata al fondo de emergencia.
// Cuando un egreso de Caja Mayor o Medios Digitales usa esta categoría, en vez
// de un egreso normal se crea un ingreso al fondo con el origen de esa cuenta
// (doble asiento con una sola fila — ver fondo-emergencia-queries.ts).
export const FONDO_EMERGENCIA_CATEGORIA = 'Fondo de emergencia'
