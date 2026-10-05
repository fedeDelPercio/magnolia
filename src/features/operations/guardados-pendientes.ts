// Guardados de la grilla que todavía esperan su debounce. Antes de cerrar el
// día (o traer stock, o reabrir) se fuerzan todos: si no, lo último que se
// tipeó podía llegar después del cierre, o perderse.

type Flush = () => Promise<void>

const pendientes = new Map<string, Flush>()

export function registrarPendiente(id: string, flush: Flush) {
  pendientes.set(id, flush)
}

export function quitarPendiente(id: string) {
  pendientes.delete(id)
}

export async function guardarPendientes(): Promise<void> {
  const flushes = [...pendientes.values()]
  pendientes.clear()
  await Promise.all(flushes.map((f) => f()))
}
