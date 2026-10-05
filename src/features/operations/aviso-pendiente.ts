// Aviso para mostrar después de una recarga dura de la página del día (por
// ejemplo, al reasignar ventas). Si el navegador no deja usar sessionStorage
// (modo privado, bloqueos), simplemente no se muestra.

const KEY = 'magnolia:operacion:aviso'

export function guardarAvisoPendiente(msg: string) {
  try {
    sessionStorage.setItem(KEY, msg)
  } catch {
    // sin aviso
  }
}

export function leerAvisoPendiente(): string | null {
  try {
    const msg = sessionStorage.getItem(KEY)
    if (msg) sessionStorage.removeItem(KEY)
    return msg
  } catch {
    return null
  }
}
