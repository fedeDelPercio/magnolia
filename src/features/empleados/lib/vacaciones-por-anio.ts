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
