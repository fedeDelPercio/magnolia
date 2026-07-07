// Helpers para hacer las acciones criticas de la app resilientes a red mala.
//
// Casos que cubren:
//   1. Cliente offline (fetch tira TypeError antes de siquiera contactar server)
//      → retry automatico 1 vez con delay de 3s. Seguro porque el server no
//        recibio nada.
//   2. Server tarda mas del timeout (45s por default) → tira TIMEOUT. NO se
//      hace retry automatico porque no sabemos si el server proceso o no
//      (retry ciego = duplicado). El caller muestra boton manual "Reintentar".
//   3. Error de logica del server (400/500 con { error: '...' }) → no es
//      excepcion, se devuelve tal cual y el caller decide que hacer.
//
// Cuando el toast id se pasa, el helper actualiza el mensaje durante el retry
// para dar feedback claro al user.

const DEFAULT_TIMEOUT_MS = 45_000
const RETRY_DELAY_MS = 3_000

export class NetworkTimeoutError extends Error {
  constructor() {
    super('TIMEOUT')
    this.name = 'NetworkTimeoutError'
  }
}

/**
 * Ejecuta una server action con:
 *  - timeout: aborta despues de `timeoutMs` (default 45s) tirando NetworkTimeoutError.
 *  - retry automatico 1 vez si el primer intento fallo por "sin conexion"
 *    (TypeError / fetch failed). No reintenta en otros errores.
 *  - callback opcional `onRetrying` para que el caller actualice UI durante el retry.
 */
export async function runWithResilience<T>(
  action: () => Promise<T>,
  opts: {
    timeoutMs?: number
    onRetrying?: () => void
  } = {},
): Promise<T> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const withTimeout = (): Promise<T> =>
    Promise.race([
      action(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new NetworkTimeoutError()), timeoutMs),
      ),
    ])

  try {
    return await withTimeout()
  } catch (err) {
    // Retry SOLO si el fetch fallo antes de contactar el server. Un TypeError
    // tipico de Next Server Actions cuando esta offline. No reintentamos
    // TIMEOUT porque el server puede haber procesado la mutation.
    if (!isPreflightNetworkError(err)) throw err

    opts.onRetrying?.()
    await sleep(RETRY_DELAY_MS)
    return await withTimeout()
  }
}

/**
 * Traduce un error atrapado a un mensaje amigable para el user.
 */
export function classifyNetworkError(err: unknown): string {
  if (err instanceof NetworkTimeoutError) {
    return 'El servidor está tardando en responder. Verificá tu conexión.'
  }
  if (isPreflightNetworkError(err)) {
    return 'Sin conexión — el cambio no se guardó. Intentá de nuevo cuando vuelva la señal.'
  }
  return 'No se pudo completar. Intentá de nuevo.'
}

function isPreflightNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof Error) {
    const msg = err.message.toLowerCase()
    return msg.includes('fetch') || msg.includes('network')
  }
  return false
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
