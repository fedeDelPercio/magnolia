-- Las vacaciones van de octubre a septiembre: `anio` es la temporada, por el
-- año en que termina (2027 = de octubre de 2026 a septiembre de 2027, se ve
-- "2026-2027"). Solo documenta; los datos ya se cargaron con ese sentido.

comment on column public.empleado_vacaciones_anuales.anio is
  'Temporada de vacaciones (octubre a septiembre) por el año en que termina: 2027 = oct 2026 a sep 2027.';
