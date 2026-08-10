-- Ventas editables por fuera del POS. Hasta ahora el sync de Bistrosoft
-- REEMPLAZABA movimientos_diarios.ventas en cada corrida, así que cualquier
-- venta cargada a mano (por fuera del POS) se pisaba al día siguiente.
--
-- ventas_bistro registra cuánto de `ventas` vino del sync. `ventas` pasa a ser
-- el TOTAL (bistro + ajuste manual). El sync actualiza su parte y conserva la
-- diferencia manual: ventas = cantidad_bistro + (ventas_prev - ventas_bistro_prev).
alter table public.movimientos_diarios
  add column if not exists ventas_bistro numeric not null default 0;

-- Backfill: los días con cierre linkeado recibieron sus ventas del sync (que
-- las reemplazaba), así que esas ventas son 100% Bistro. Los días sin cierre
-- fueron carga manual y quedan con ventas_bistro = 0.
update public.movimientos_diarios md
set ventas_bistro = md.ventas
from public.cierres_caja cc
where cc.dia_operativo_id = md.dia_id
  and md.ventas <> 0;
