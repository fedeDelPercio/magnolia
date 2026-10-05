# Hallazgos de QA · 2026-10-05

Plan: `qa/plan-2026-10-05.md`. Agentes: UI (scripts propios, tenant Magnolia Test) y código (diff + rama `feat/empleados-reventa`).
Evidencia de UI: `qa/evidencia-2026-10-05/`.

## Cobertura unida
- UI: 26 pasos del plan → 25 PASA, 1 FALLA (F-B1.5, decimales). Bordes: 6 FALLA (ver H-1…H-6). NO PROBADO: preselección de "Genérico" (el tenant de prueba no lo tiene), usuario sin permiso (no hay roles distintos de owner), rechazo del servidor en día cerrado por llamada directa.
- Código: 20 puntos revisados; FALLA en K3, K5, K7, K9, K13, K14, K15, K18 (ver hallazgos).
- Foto de control de Magnolia Demo: ver "Control" al final.

Veredictos: `corregir` · `corregido` · `pendiente (motivo)` · `por diseño` · `descartado`.

## Hallazgos

| Id | Sev. | Título | Origen | Veredicto |
|----|------|--------|--------|-----------|
| H-1 | alta | La grilla abierta en otra pestaña pisa la reasignación (guarda la fila entera con ventas viejas) y duplica la venta | UI (2 veces) | corregido (c132473): la grilla guarda solo los campos editados |
| H-2 | alta | Celular 390 px: con "Reasignar ventas" el encabezado del día mide 470 px, "Cerrar día" queda afuera y el diálogo cortado | UI + código | corregido (c132473): flex-wrap en el encabezado |
| H-3 | alta | Editar cualquier campo de la grilla convierte un conteo vacío (NULL) en 0, que el arrastre toma como "contado 0" | UI (preexistente) | corregido (c132473): conteo vacío = null; borrar el conteo vuelve a "no contado" |
| H-4 | alta | Se pueden cargar pagos sobre compras ya pagadas: en Magnolia Demo hay 5 compras con el pago duplicado (Luchador 23/07, 07/09, 19/09; Carrefour 31/08, 21/09), $166.159,52 de egresos de más y $157.855,12 en cheques posiblemente inexistentes | código + SQL (preexistente) | corregido (c132473): createPago/updatePago no pasan del faltante de la compra · los 5 duplicados reales quedan para la dueña |
| H-5 | alta | Editar una compra ya pagada no recalcula su estado (Papelera 11/08 figura "Pagada" con $13.636,70 sin pagar) | código + SQL (preexistente) | corregido (c132473): updateCompra llama a recalcularEstadoCompra · Papelera 11/08 se corrige al próximo cambio o con migración |
| H-6 | alta | Ficha del proveedor: "Al día" con saldo a favor escondido mientras una compra dice "faltan $60.000"; antigüedad de deuda mayor que el saldo | UI (preexistente, vista `saldos_proveedores`) | corregido en pantalla (c132473): saldo a favor visible; antigüedad resta pagos parciales y aplica pagos sueltos a lo más viejo · la vista sigue igual (migración) |
| H-7 | alta | Celular 390 px: en la revisión del comprobante el selector de insumo tapa Cantidad y el lápiz pisa Precio total | UI (layout preexistente) | corregido (c132473): insumo a fila completa en celular |
| H-8 | alta | (rama) 0080 deja de descontar Helado, Muffins Delivery y Copa Vino: la venta cae en una variante sin receta | código (simulación SQL) | corregir en la rama |
| H-9 | media | Reasignar: el ajuste no sobrevive a todos los re-sync (destino que Bistro trae después; origen que baja → ventas negativas; doble corrección POS + app) | código | corregido parcial (c132473): piso 0 en el sync + aviso en el diálogo · columna de ajuste aparte: pendiente (migración) |
| H-10 | media | Reasignar no cambia el Dashboard (lee lo cobrado en Bistrosoft) | código | corregido (c132473): el diálogo aclara que no cambia los reportes en pesos |
| H-11 | media | Editar/anular pago: pasos sin transacción; si se corta, caja desfasada sin forma de arreglarlo | código | corregido (c132473): caja primero, reinserción si falla, autorreparación al editar · trigger: pendiente (migración) |
| H-12 | media | (rama) Borrar una liquidación cuyo arrastre ya se aplicó descuenta dos veces | código | corregir en la rama |
| H-13 | media | (rama) Liquidación por rango no muestra descuentos | código | corregir en la rama |
| H-14 | media | (rama) Reventa por venta ignora almuerzo y desperdicio | código + SQL | corregir en la rama |
| H-15 | media | Compra manual con despiece compara contra precio viejo del padre; la vista previa del despiece ignora la unidad de compra (dice 12 y guarda 72) | código + SQL | corregido (c132473): vista previa con cantidad base; sin comparación con despiece |
| H-16 | media | "Hoy" en UTC: después de las 21 h los pagos quedan con fecha de mañana | código (preexistente) | corregido en proveedores (c132473): hoyISO() en hora de Argentina · otros 12 archivos fuera de proveedores: pendiente |
| H-17 | media | Reasignar con decimales: "1.5" se acepta y mueve 1 | UI + código | corregido (c132473): solo enteros escritos tal cual |
| H-18 | media | Los pagos no dicen a qué compra corresponden; orden inestable entre fechas iguales | UI | corregido (c132473): "Compra del dd/mm por $X" en fila, diálogo y confirm; desempate por created_at |
| H-19 | media | Reasignar muestra lo vendido sin las correcciones recién hechas en la grilla | UI | corregido (c132473): lee ventas frescas al abrir |
| H-20 | media | "Marcar como pagada" crea pago y egreso sin confirmar ni avisar | UI (preexistente) | corregido (c132473): confirm con monto + toast |
| H-21 | media | Corte de red con Supabase: el guardado se pierde sin aviso (proxy redirige a /login) | UI (preexistente, 1 vez) | pendiente: afecta a toda la app, fuera de alcance |
| H-22 | media | Cerrar la pestaña durante la revisión del comprobante deja el upload en `parsed` y el PDF en Storage | UI (preexistente) | pendiente: limpieza programada, fuera de alcance |
| H-23 | baja | El toast de éxito de Reasignar no se ve (recarga) | UI + código | corregido (c132473): aviso guardado en sessionStorage y mostrado tras recargar |
| H-24 | baja | Escape con la lista del selector abierta cierra todo el diálogo | UI | corregido (c132473): stopPropagation en el selector compartido |
| H-25 | baja | Variación 0,0 % con flecha hacia abajo | UI | corregido (c132473): ícono neutro y "0.0%" |
| H-26 | baja | Textos: "c/desc. e IVA" sin descuento en compra manual; "10-30 segundos" y "15 MB" no coinciden | UI | corregido (c132473): "c/IVA" sin descuento; textos de tiempo y tamaño · plural "2 unidad": pendiente |
| H-27 | baja | "Pago no encontrado" no dice qué hacer | UI | corregido (c132473): "Este pago ya no existe (quizás lo anuló otra persona). Recargá la página." |
| H-28 | baja | (rama) Error al vincular descuentos se ignora; doble cierre simultáneo duplica el arrastre | código | corregir en la rama |
| H-29 | baja | (rama) Costo sugerido de platos del día en 0; minutos no se recalculan al cambiar la fecha; fecha de "recuperado" en UTC | código | corregir en la rama |
| H-30 | baja | "Último" es el último cargado, no el último por fecha | código + SQL (preexistente) | pendiente: cambia cómo se actualiza `current_price` (trigger) |
| H-31 | mejora | Marcar bajas grandes de precio en la factura escaneada (suelen ser lectura mala) | código | corregido (c132473): baja ≥ 30 % en ámbar con aviso |
| H-32 | mejora | Botón "…" del pago de 24 px en celular | UI | corregido (c132473): 36 px en celular |
| H-33 | mejora | Reasignar: contexto del grupo; destino sin fila en el día | código + UI | pendiente |
| H-34 | mejora | Sin restricción por rol para anular pagos / reasignar | UI | pendiente: hoy todos los usuarios son owner |

## Retest 1 (commit c132473)

- UI: de 19 corregidos, 18 PASA y H-23 FALLA (el toast se emitía antes de que el Toaster escuchara).
- Código: K1–K23 revisados; nuevos H-C1…H-C10.

| Id | Sev. | Título | Veredicto |
|----|------|--------|-----------|
| H-C1 / N-1 | alta | La grilla nunca olvidaba los campos tocados: una pestaña vieja que ya había editado "ventas" las reenviaba y pisaba la reasignación (UI confirmado 2 veces) | corregido (e8262c0): los campos se olvidan al guardar bien; si falla, quedan pendientes y avisa |
| H-C2 | media | El tope de pago con margen de 1 centavo bloqueaba pagos reales redondeados y editar pagos viejos | corregido (e8262c0): tolerancia $100 o 0,5 %; editar sin subir el monto siempre se permite |
| H-C3 | media | Antigüedad no sumaba el saldo con compras pagadas de más (Luchador) o "pagadas" con faltante (Papelera) | corregido (e8262c0): verificado por SQL, diferencia 0 en los 10 proveedores con deuda |
| H-C4 | media | La grilla podía escribir en un día cerrado (pestaña vieja o guardado demorado al cerrar) | corregido (e8262c0): saveMovimiento rechaza días cerrados; cerrar y traer stock fuerzan los guardados pendientes |
| H-C5 | baja | La consolidación no pasaba producción vieja de la base a la variante con receta | corregido (e8262c0) |
| H-C6 | baja | Con el piso en 0, una anulación en Bistro sobre un producto ya reasignado deja unidades de más | pendiente: requiere guardar el ajuste en columna aparte (migración) |
| H-C7 / N-4 | baja | Dos anulaciones simultáneas del mismo pago dejaban un egreso huérfano | corregido (e8262c0): si el pago ya no está, no se reinserta el egreso |
| H-C8 | baja | Conteo negativo tipeado se guardaba como "contado 0" | corregido (e8262c0): "-" se ignora |
| H-C9 / N-7 | media | Sin conteo, Diferencia mostraba −teórico; "sin contar" se veía igual que 0 | corregido (e8262c0, f4bdaa2): "—" en Diferencia y como placeholder del conteo |
| H-C10 | mejora | /alertas evalúa reglas de pago con el total de compras pendientes | pendiente (hoy coincide con el saldo) |
| H-23 | baja | Toast de Reasignar tras recargar | corregido (f4bdaa2): se emite en el siguiente ciclo |
| N-3 | media | Dos pestañas que saldan la misma compra a la vez crean el pago dos veces (32 ms) | pendiente: necesita bloqueo en la base (RPC con `for update` o constraint) → migración |
| N-5 | media | Reasignar sin conexión quedaba cargando para siempre | corregido (f4bdaa2) |
| N-6 | media | Con plata pagada sin compra, la compra sigue invitando a "Saldar" | corregido parcial (f4bdaa2): aviso al saldar; vincular un pago suelto a una compra queda como mejora |
| N-8 | media | Monto con Tab: tipear agregaba dígitos al final (preexistente) | corregido (f4bdaa2): se selecciona todo al enfocar |
| N-9 | baja | Reasignar abierto antes de 700 ms muestra el valor anterior | por diseño: el servidor lo rechaza con "Las ventas cambiaron…" |
| N-10 | baja | Mensaje confuso al subir el monto de un pago de compra pagada | corregido (f4bdaa2) |
| N-11 | mejora | Aviso de baja grande solo en tooltip | corregido (f4bdaa2): texto visible |
| N-12 | baja | 320 px: el encabezado global desborda 4 px (preexistente) | pendiente: por debajo del criterio de 390 px |

### Datos de prueba que quedaron distintos en Magnolia Test
- Pago de la compra 06/05 de Carniceria recreado (`f5cbc6e6…`); el original `20cb26fe…` se anuló.
- Conteo de Empanada de carne del 30/04 en 0 (grabado por el bug de H-3 en la corrida 1).
- Uploads `discarded` de prueba; uno `parsed` huérfano (`4d328dcc…`) de un script cortado.

### Control de Magnolia Demo
Foto 14:30 y 15:25 UTC idénticas. Después aparecieron 5 compras nuevas (Luchador ×2, Aguas Medina, Carrefour ×2, 15:56–16:00 UTC) y un comprobante: es la clienta trabajando; el navegador compartido siguió quieto en la ficha de FEMSA (solo recargas de código en su consola).
