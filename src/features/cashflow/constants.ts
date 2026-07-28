// Categoría especial de egreso que DERIVA plata al fondo de emergencia.
// Cuando un egreso de Caja Mayor o Medios Digitales usa esta categoría, en vez
// de un egreso normal se crea un ingreso al fondo con el origen de esa cuenta
// (doble asiento con una sola fila — ver fondo-emergencia-queries.ts).
export const FONDO_EMERGENCIA_CATEGORIA = 'Fondo de emergencia'

// Categoría especial para correcciones de saldo (conteo real vs. sistema).
// Disponible como ingreso o egreso en Medios Digitales, Caja Mayor y Fondo de
// emergencia. Ajusta el saldo de la cuenta pero NO cuenta como flujo real del
// mes: /caja la excluye de los totales de ingresos/egresos, y el dashboard no
// la considera costo (solo mira 'Pago a empleados' / compras).
export const AJUSTE_CATEGORIA = 'Ajuste de caja'
