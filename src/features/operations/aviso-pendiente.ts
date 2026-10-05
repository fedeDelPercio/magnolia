// Aviso para mostrar después de una recarga dura de la página del día (por
// ejemplo, al reasignar ventas, o cuando un guardado rebotó porque el día ya
// estaba cerrado). Si el navegador no deja usar sessionStorage (modo privado,
// bloqueos), simplemente no se muestra.

const KEY = 'magnolia:operacion:aviso'

type Tipo = 'success' | 'error'

// Un aviso que no se mostró enseguida (la recarga no ocurrió) ya no
// corresponde: no aparece después en otro día.
const VIGENCIA_MS = 60000

export function guardarAvisoPendiente(msg: string, tipo: Tipo = 'success') {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ msg, tipo, at: Date.now() }))
  } catch {
    // sin aviso
  }
}

export function leerAvisoPendiente(): { msg: string; tipo: Tipo } | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const parsed = JSON.parse(raw) as { msg?: unknown; tipo?: unknown; at?: unknown }
    if (typeof parsed.msg !== 'string') return null
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > VIGENCIA_MS) return null
    return { msg: parsed.msg, tipo: parsed.tipo === 'error' ? 'error' : 'success' }
  } catch {
    return null
  }
}
