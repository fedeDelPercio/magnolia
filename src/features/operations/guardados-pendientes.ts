// Guardados de la grilla que todavía no llegaron a la base: los que esperan su
// debounce y los que fallaron (sin conexión, error del servidor). Antes de
// cerrar el día o traer stock se fuerzan todos, y si alguno no se puede
// guardar la acción se frena: un día no puede cerrarse con un conteo que la
// pantalla muestra pero la base no tiene.

// Devuelve true si guardó (o no había nada para guardar).
type Flush = () => Promise<boolean>

const pendientes = new Map<string, { nombre: string; flush: Flush }>()

export function registrarPendiente(id: string, nombre: string, flush: Flush) {
  pendientes.set(id, { nombre, flush })
}

export function quitarPendiente(id: string) {
  pendientes.delete(id)
}

/** Fuerza todos los guardados pendientes. Devuelve los nombres de los que fallaron. */
export async function guardarPendientes(): Promise<string[]> {
  const items = [...pendientes.values()]
  const resultados = await Promise.all(
    items.map(async (p) => {
      try {
        return (await p.flush()) ? null : p.nombre
      } catch {
        return p.nombre
      }
    }),
  )
  return resultados.filter((n): n is string => n !== null)
}
