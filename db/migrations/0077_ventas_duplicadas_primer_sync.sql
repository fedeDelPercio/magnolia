-- Reparación: ventas duplicadas por el primer sync de Bistro.
--
-- El sync de Bistro conserva el "ajuste manual" de cada fila como
-- ventas - ventas_bistro, para no pisar lo que la dueña carga a mano por
-- fuera del POS. Pero cuando la fila NUNCA había sido sincronizada
-- (ventas_bistro = 0) y la dueña ya había tipeado el total a mano —porque la
-- API estuvo caída del 26/08 al 03/09 y cargó las ventas desde el PDF—, el
-- primer sync interpretó ese total como "extra" y lo SUMÓ al dato de Bistro:
-- Empanadas de Carne Delivery 26/08 quedó en 46 con Bistro diciendo 23.
-- 323 filas, 1.325 unidades de más entre el 26/08 y el 02/09 (274 dobles
-- exactos; el resto, tipeos desde el PDF que no coincidían al 100% con la API).
-- El mismo patrón, a escala chica, en productos mapeados a Bistro después de
-- cargados (2 vs 1, 4 vs 2) hasta el 12/09.
--
-- Criterio: donde Bistro tiene un dato (ventas_bistro > 0) y la fila fue
-- modificada por el sync DESPUÉS de cerrado el día, ventas = ventas_bistro,
-- que es la fuente que usa el sistema todos los demás días. Los ajustes que
-- la dueña hizo al cerrar (updated_at = closed_at) se respetan.
-- El código del sync se corrige aparte: primer sync REEMPLAZA, no suma.

update public.movimientos_diarios m
set ventas = m.ventas_bistro
from public.dias_operativos d
where d.id = m.dia_id
  and d.status = 'cerrado'
  and d.fecha between date '2026-08-26' and date '2026-09-02'
  and m.ventas_bistro > 0
  and m.ventas > m.ventas_bistro
  and m.updated_at > d.closed_at;

update public.movimientos_diarios m
set ventas = m.ventas_bistro
from public.dias_operativos d
where d.id = m.dia_id
  and d.status = 'cerrado'
  and d.fecha between date '2026-09-03' and date '2026-09-12'
  and m.ventas_bistro > 0
  and m.ventas = 2 * m.ventas_bistro
  and m.updated_at > d.closed_at;
