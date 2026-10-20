export type DiasPorAnio = { empleado_id: string; anio: number; dias: number }

/**
 * Días de vacaciones que le corresponden a un empleado en un año: lo cargado
 * para ese año; si no hay, lo del año anterior más cercano (un cambio sigue
 * valiendo hasta que se cambie de nuevo); si no hay nada, el valor con el que
 * se dio de alta (`base`).
 */
export function diasQueCorresponden(base: number, porAnio: DiasPorAnio[], empleadoId: string, anio: number): number {
  let elegida: DiasPorAnio | undefined
  for (const f of porAnio) {
    if (f.empleado_id !== empleadoId || f.anio > anio) continue
    if (!elegida || f.anio > elegida.anio) elegida = f
  }
  return elegida ? elegida.dias : base
}

// ---- Temporadas ----------------------------------------------------------
// Las vacaciones van de octubre a septiembre. Una temporada se identifica por
// el año en que termina: 2027 = de octubre de 2026 a septiembre de 2027 (se
// muestra "2026-2027"). Es la misma clave que `anio` en
// empleado_vacaciones_anuales. Cada toma cuenta en la temporada en que empieza.

export function temporadaDe(fechaISO: string): number {
  const año = Number(fechaISO.slice(0, 4))
  return Number(fechaISO.slice(5, 7)) >= 10 ? año + 1 : año
}

export function etiquetaTemporada(temporada: number): string {
  return `${temporada - 1}-${temporada}`
}
