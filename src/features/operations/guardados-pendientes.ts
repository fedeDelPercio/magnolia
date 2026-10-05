// Registro de las filas de la grilla de Operación, por día. Cada fila montada se
// anota con una función que fuerza su guardado (y espera el que ya está en
// curso). Antes de cerrar el día, traer stock o reasignar ventas se fuerzan
// todas las filas de ESE día, y si alguna no se pudo guardar la acción se
// frena: un día no puede cerrarse con un dato que la pantalla muestra pero la
// base no tiene. Al desmontarse (salir de la pantalla) la fila se borra del
// registro, así lo de un día no interfiere con otro.

type Fila = {
  nombre: () => string
  // Devuelve true si todo lo de la fila quedó guardado.
  guardar: () => Promise<boolean>
  // Hay algo tipeado que todavía no confirmó la base (o un guardado en curso).
  pendiente: () => boolean
}

const porDia = new Map<string, Map<string, Fila>>()

export function registrarFila(diaId: string, filaId: string, fila: Fila) {
  let filas = porDia.get(diaId)
  if (!filas) {
    filas = new Map()
    porDia.set(diaId, filas)
  }
  filas.set(filaId, fila)
}

export function quitarFila(diaId: string, filaId: string) {
  const filas = porDia.get(diaId)
  if (!filas) return
  filas.delete(filaId)
  if (filas.size === 0) porDia.delete(diaId)
}

/** Fuerza el guardado de todas las filas del día. Devuelve los nombres de las que fallaron. */
export async function guardarPendientes(diaId: string): Promise<string[]> {
  const filas = [...(porDia.get(diaId)?.values() ?? [])]
  const resultados = await Promise.all(
    filas.map(async (f) => {
      try {
        return (await f.guardar()) ? null : f.nombre()
      } catch {
        return f.nombre()
      }
    }),
  )
  return resultados.filter((n): n is string => n !== null)
}

// Guardados que siguen en curso cuando su fila ya se desmontó (se salió del
// día con el botón Atrás del navegador, por ejemplo). La pantalla del día
// siguiente los espera antes de compararse con la base: lo que guardan puede
// cambiar su stock arrastrado.
const alSalir = new Set<Promise<unknown>>()

export function registrarGuardadoAlSalir(p: Promise<unknown>) {
  alSalir.add(p)
  void p.catch(() => {}).finally(() => alSalir.delete(p))
}

/** Espera esos guardados (con un tope: un envío colgado no frena la pantalla nueva). */
export async function esperarGuardadosAlSalir(maxMs = 25000): Promise<void> {
  if (alSalir.size === 0) return
  let t: ReturnType<typeof setTimeout> | undefined
  await Promise.race([
    Promise.allSettled([...alSalir]),
    new Promise<void>((resolve) => {
      t = setTimeout(resolve, maxMs)
    }),
  ])
  clearTimeout(t)
}

export function hayPendientes(diaId: string): boolean {
  for (const f of porDia.get(diaId)?.values() ?? []) {
    if (f.pendiente()) return true
  }
  return false
}
